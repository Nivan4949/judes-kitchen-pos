const PDFDocument = require('pdfkit');

/**
 * PDF Utility to generate professional invoices
 */
const pdfUtil = {
  /**
   * Generates a Sales Invoice PDF
   * @param {Object} order - The order object with orderItems and products
   * @param {Stream} res - The writable HTTP stream (express res)
   */
  generateInvoicePDF: (order, res) => {
    const doc = new PDFDocument({ margins: { top: 40, bottom: 20, left: 40, right: 40 }, size: 'A4' });

    // Stream the PDF directly to the response
    doc.pipe(res);

    // --- Header Section ---
    doc.font('Helvetica-Bold')
       .fontSize(22)
       .text("JUDE'S KITCHEN", { align: 'center' });
    
    doc.font('Helvetica')
       .fontSize(10)
       .text('DHOTTAPPANKULAM, SULTHAN BATHERY, WAYANAD', { align: 'center' });
    
    doc.moveDown(0.5);
    
    // FSSAI and Mob Row
    const topOfContact = doc.y;
    doc.fontSize(9)
       .text(`FSSAI NO: 21326248000559`, 40, topOfContact, { align: 'left' })
       .text(`Mob: +91 89431 21110`, 40, topOfContact, { align: 'right' });

    doc.moveDown(1);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).lineWidth(1).stroke('#EEEEEE');
    doc.moveDown(1);

    // --- Bill Details ---
    const topOfDetails = doc.y;
    doc.font('Helvetica-Bold').fontSize(11).text(`TAX INVOICE: ${order.invoiceNo}`, 40, topOfDetails);
    doc.font('Helvetica').fontSize(9).text(`Date: ${new Date(order.createdAt).toLocaleDateString()} ${new Date(order.createdAt).toLocaleTimeString()}`, 40, topOfDetails + 15);
    doc.font('Helvetica-Bold').fontSize(10).text(`Type: ${order.orderType || 'Walk-in'}`, 40, topOfDetails + 30);
    doc.font('Helvetica').fontSize(10).text(`Customer: ${order.customer?.name || order.customerName || 'Walk-in'}`, 40, topOfDetails + 30, { align: 'right' });

    doc.moveDown(3);

    // --- Table Header ---
    const tableTop = doc.y;
    doc.fillColor('#F8F9FA')
       .rect(40, tableTop, 515, 20)
       .fill();

    doc.fillColor('#333333')
       .font('Helvetica-Bold')
       .fontSize(9)
       .text('#', 50, tableTop + 6)
       .text('Description', 80, tableTop + 6)
       .text('Qty', 300, tableTop + 6)
       .text('FRP', 360, tableTop + 6)
       .text('MRP', 420, tableTop + 6)
       .text('Amount', 480, tableTop + 6, { align: 'right', width: 65 });

    doc.moveTo(40, tableTop + 20).lineTo(555, tableTop + 20).stroke('#DDDDDD');

    // --- Table Content ---
    let y = tableTop + 25;
    const items = order.orderItems || [];
    
    items.forEach((item, index) => {
      const itemName = item.product?.name || item.name || 'Product';
      doc.font('Helvetica')
         .fontSize(9)
         .fillColor('#000000')
         .text((index + 1).toString(), 50, y)
         .text(itemName.toUpperCase(), 80, y, { width: 210 })
         .text((Number(item.quantity) || 0).toFixed(0), 300, y)
         .text((Number(item.price) || 0).toFixed(2), 360, y)
         .text((Number(item.mrp || item.product?.mrp || item.price || 0)).toFixed(0), 420, y)
         .font('Helvetica-Bold')
         .text((Number(item.total) || 0).toFixed(2), 480, y, { align: 'right', width: 65 });

      y += 20;

      // Check for page break
      if (y > 600) {
        doc.addPage();
        y = 50;
      }
    });

    // --- Totals Section ---
    const totalY = y + 10;
    doc.moveTo(40, totalY).lineTo(555, totalY).lineWidth(0.5).dash(5, { space: 2 }).stroke('#CCCCCC').undash();
    
    const summaryX = 350;
    let summaryY = totalY + 15;

    doc.font('Helvetica-Bold').fontSize(10);
    
    const drawRow = (label, value, isBold = true) => {
      if (isBold) doc.font('Helvetica-Bold');
      else doc.font('Helvetica');
      
      doc.text(label, summaryX, summaryY);
      doc.text(value, 480, summaryY, { align: 'right', width: 65 });
      summaryY += 15;
    };

    drawRow('Total Items :', (order.itemsCount || items.length).toString(), false);
    drawRow('Total Qty :', (Number(order.totalQty) || items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0)).toFixed(0), false);
    drawRow('Total :', (Number(order.subtotal) || 0).toFixed(2), false);
    drawRow('Discount :', (Number(order.discount) || 0).toFixed(2), false);
    
    doc.moveTo(summaryX, summaryY).lineTo(555, summaryY).stroke('#EEEEEE');
    summaryY += 8;
    
    drawRow('Net Total :', `Rs. ${(Number(order.roundedTotal) || 0).toFixed(2)}`, true);
    drawRow('Tender :', `Rs. ${(Number(order.amountPaid) || 0).toFixed(2)}`, false);
    drawRow('Balance :', `Rs. ${(Number(order.balance) || 0).toFixed(2)}`, true);

    // --- Savings Badge ---
    const savings = Number(order.savings) || 0;
    if (savings > 0) {
      doc.moveDown(0.5);
      doc.fillColor('#28a745')
         .font('Helvetica-Bold')
         .fontSize(12)
         .text(`YOU SAVED RS.${savings.toFixed(2)}`, 40, summaryY + 5, { align: 'center' });
    }

    // --- Footer ---
    doc.fillColor('#444444')
       .font('Helvetica')
       .fontSize(8)
       .text(`Payment Mode: ${order.paymentMode || 'CASH'}`, 40, 735)
       .text(`Processed By: ${order.userName || 'Staff'}`, 40, 745);

    doc.font('Helvetica-Bold')
       .fontSize(10)
       .fillColor('#000000')
       .text('THANK YOU VISIT AGAIN', 40, 760, { align: 'center' });

    doc.end();
  },

  /**
   * Generates a Credit Note PDF
   */
  generateReturnPDF: (salesReturn, res) => {
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fillColor('#444444')
       .fontSize(20)
       .text('CREDIT NOTE', 50, 50, { align: 'left' })
       .fontSize(10)
       .text("JUDE'S KITCHEN", 200, 50, { align: 'right' });

    doc.moveDown();
    doc.fillColor('#000000')
       .fontSize(10)
       .text(`Return No: ${salesReturn.returnNo}`, 50, 100)
       .text(`Date: ${new Date(salesReturn.createdAt).toLocaleString()}`, 50, 115)
       .text(`Customer: ${salesReturn.customer?.name || 'Walk-in'}`, 50, 130)
       .moveDown();

    // Table
    const tableTop = 160;
    doc.text('Item', 60, tableTop)
       .text('Qty', 280, tableTop)
       .text('Price', 350, tableTop)
       .text('Total', 500, tableTop);

    let y = tableTop + 20;
    salesReturn.returnItems?.forEach(item => {
      doc.text(item.product?.name || 'Product', 60, y)
         .text(item.quantity.toString(), 280, y)
         .text(`Rs.${item.price.toFixed(2)}`, 350, y)
         .text(`Rs.${item.total.toFixed(2)}`, 500, y);
      y += 20;
    });

    doc.moveDown()
       .fontSize(12)
       .text(`Total Refunded: Rs.${salesReturn.totalAmount.toFixed(2)}`, 350, y + 20, { bold: true });

    doc.fontSize(8)
       .fillColor('#999999')
       .text('Amount credited to your digital wallet.', 50, 690, { align: 'center' });
    doc.end();
  }
};

module.exports = pdfUtil;
