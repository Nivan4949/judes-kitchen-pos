const prisma = require('../config/prisma');

class APService {
    /**
     * Get unified ledger for a supplier
     */
    async getSupplierLedger(supplierId) {
        const supplier = await prisma.supplier.findUnique({
            where: { id: supplierId },
            include: {
                purchases: {
                    orderBy: { date: 'asc' },
                    include: { purchaseItems: { include: { product: true } } }
                },
                purchaseReturns: {
                    orderBy: { date: 'asc' }
                },
            }
        });

        if (!supplier) throw new Error('Supplier not found');

        const payments = await prisma.purchasePayment.findMany({
            where: {
                OR: [
                    { supplierId },
                    { purchase: { supplierId } }
                ]
            },
            orderBy: { date: 'asc' }
        });

        let events = [];

        supplier.purchases.forEach(p => {
            events.push({
                id: p.id,
                date: p.date,
                type: 'PURCHASE',
                reference: p.invoiceNo,
                amount: p.grandTotal,
                items: p.purchaseItems
            });
        });

        payments.forEach(pay => {
            events.push({
                id: pay.id,
                date: pay.date,
                type: 'PAYMENT_OUT',
                reference: pay.transactionId || 'Settlement',
                amount: -pay.amount,
                method: pay.method
            });
        });

        supplier.purchaseReturns.forEach(pr => {
            events.push({
                id: pr.id,
                date: pr.date,
                type: 'PURCHASE_RETURN',
                reference: pr.returnNo,
                amount: -pr.totalAmount
            });
        });

        events.sort((a, b) => new Date(a.date) - new Date(b.date));

        let currentBalance = supplier.openingBalance;
        const ledger = events.map(event => {
            currentBalance += event.amount;
            return {
                ...event,
                runningBalance: currentBalance
            };
        });

        return {
            supplierInfo: {
                id: supplier.id,
                name: supplier.name,
                openingBalance: supplier.openingBalance,
                currentBalance
            },
            ledger
        };
    }

    async processPurchase(data, io) {
        return await prisma.$transaction(async (tx) => {
            const purchase = await tx.purchase.create({
                data: {
                    invoiceNo: data.invoiceNo || `PUR-${Date.now()}`,
                    supplierId: data.supplierId,
                    supplierName: data.supplierName,
                    subtotal: data.subtotal,
                    taxTotal: data.taxTotal || 0,
                    grandTotal: data.grandTotal,
                    amountPaid: data.amountPaid || 0,
                    balanceDue: data.grandTotal - (data.amountPaid || 0),
                    paymentStatus: (data.amountPaid || 0) >= data.grandTotal ? 'PAID' : ((data.amountPaid || 0) > 0 ? 'PARTIAL' : 'PENDING'),
                    date: data.date ? new Date(data.date) : new Date(),
                    purchaseItems: {
                        create: data.items.map(item => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            price: item.price,
                            taxAmount: 0,
                            total: (item.quantity * item.price)
                        }))
                    },
                    payments: (data.amountPaid > 0) ? {
                        create: {
                            amount: data.amountPaid,
                            method: data.paymentMode || 'CASH',
                            date: data.date ? new Date(data.date) : new Date()
                        }
                    } : undefined
                }
            });

            for (const item of data.items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stockQuantity: { increment: item.quantity } }
                });

                await tx.inventoryLog.create({
                    data: {
                        productId: item.productId,
                        type: 'IN',
                        quantity: item.quantity,
                        reason: `AP Purchase: ${data.invoiceNo}`
                    }
                });
            }

            if (io) {
                io.emit('INVENTORY_UPDATE', { items: data.items.map(i => ({ id: i.productId, quantity: i.quantity })) });
            }

            return purchase;
        });
    }

    async processPaymentOut(data) {
        return await prisma.$transaction(async (tx) => {
            let remainingToApply = data.amount;

            const pendingPurchases = await tx.purchase.findMany({
                where: { 
                    supplierId: data.supplierId,
                    paymentStatus: { in: ['PENDING', 'PARTIAL'] }
                },
                orderBy: { date: 'asc' }
            });

            for (const p of pendingPurchases) {
                if (remainingToApply <= 0) break;

                const canApply = Math.min(remainingToApply, p.balanceDue);
                
                await tx.purchasePayment.create({
                    data: {
                        purchaseId: p.id,
                        amount: canApply,
                        method: data.method || 'CASH',
                        transactionId: data.transactionId,
                        date: data.date ? new Date(data.date) : new Date()
                    }
                });

                await tx.purchase.update({
                    where: { id: p.id },
                    data: {
                        amountPaid: { increment: canApply },
                        balanceDue: { decrement: canApply },
                        paymentStatus: (p.amountPaid + canApply) >= p.grandTotal ? 'PAID' : 'PARTIAL'
                    }
                });

                remainingToApply -= canApply;
            }

            if (remainingToApply > 0) {
                // Any leftover money is an "Advance" or General Payment
                await tx.purchasePayment.create({
                    data: {
                        supplierId: data.supplierId,
                        amount: remainingToApply,
                        method: data.method || 'CASH',
                        transactionId: data.transactionId,
                        date: data.date ? new Date(data.date) : new Date()
                    }
                });
            }

            return { settled: data.amount - remainingToApply, advance: remainingToApply };
        });
    }

    async deletePurchase(id, io) {
        return await prisma.$transaction(async (tx) => {
            const purchase = await tx.purchase.findUnique({
                where: { id },
                include: { purchaseItems: true }
            });

            if (!purchase) throw new Error('Purchase not found');

            for (const item of purchase.purchaseItems) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stockQuantity: { decrement: item.quantity } }
                });

                await tx.inventoryLog.create({
                    data: {
                        productId: item.productId,
                        type: 'OUT',
                        quantity: item.quantity,
                        reason: `AP DELETE Reverse: ${purchase.invoiceNo}`
                    }
                });
            }

            await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
            await tx.purchasePayment.deleteMany({ where: { purchaseId: id } });
            
            const deleted = await tx.purchase.delete({ where: { id } });

            if (io) {
                io.emit('INVENTORY_UPDATE', { items: purchase.purchaseItems.map(i => ({ id: i.productId, quantity: i.quantity })) });
            }

            return deleted;
        });
    }

    async deletePaymentOut(id) {
        return await prisma.$transaction(async (tx) => {
            const payment = await tx.purchasePayment.findUnique({
                where: { id },
                include: { purchase: true }
            });

            if (!payment) throw new Error('Payment not found');

            if (payment.purchaseId) {
                await tx.purchase.update({
                    where: { id: payment.purchaseId },
                    data: {
                        amountPaid: { decrement: payment.amount },
                        balanceDue: { increment: payment.amount },
                        paymentStatus: 'PARTIAL'
                    }
                });
            }

            return await tx.purchasePayment.delete({ where: { id } });
        });
    }
}

module.exports = new APService();
