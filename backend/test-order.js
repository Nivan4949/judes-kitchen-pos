const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testOrder() {
  try {
    const orderItems = [
      { id: 'clun6b2z60000ux78l9qrv4j1', name: 'Coconut oil', quantity: 1, sellingPrice: 350, gstRate: 18 }
    ];
    
    // Substitute a real ID from your DB if the above is dummy
    const firstProduct = await prisma.product.findFirst();
    if (!firstProduct) return console.log('No products found');
    
    const items = [{
        id: firstProduct.id,
        name: firstProduct.name,
        quantity: 1,
        sellingPrice: firstProduct.sellingPrice,
        gstRate: 18
    }];

    const result = await prisma.$transaction(async (tx) => {
      // Stock guard check
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.id } });
        if (product.stockQuantity < item.quantity) throw new Error('Insufficient Stock');
      }

      const newOrder = await tx.order.create({
        data: {
          invoiceNo: 'TEST-' + Date.now(),
          subtotal: 350,
          discount: 0,
          taxTotal: 63,
          grandTotal: 413,
          paymentMode: 'CASH',
          status: 'COMPLETED',
          orderItems: {
            create: items.map(i => ({
              productId: i.id,
              quantity: i.quantity,
              price: i.sellingPrice,
              taxAmount: 63,
              total: 413
            }))
          }
        }
      });
      return newOrder;
    });
    console.log('Success:', result.invoiceNo);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

testOrder();
