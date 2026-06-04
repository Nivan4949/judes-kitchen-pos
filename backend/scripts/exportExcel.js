const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BACKUP_DIR = path.join(__dirname, '../backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

async function uploadToGoogleDrive(filePath, fileName) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const folderId = process.env.DRIVE_FOLDER_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground';

  if (!refreshToken || refreshToken === 'your_refresh_token_here') {
    log('GOOGLE_REFRESH_TOKEN not set or is still placeholder, skipping cloud upload.');
    return;
  }
  if (!folderId) {
    log('DRIVE_FOLDER_ID not defined in .env, skipping cloud upload.');
    return;
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Check if a backup with the same name already exists to prevent duplicates
    const res = await drive.files.list({
      q: `'${folderId}' in parents and name='${fileName}' and trashed=false`,
      fields: 'files(id, name)',
    });

    if (res.data.files.length > 0) {
      log(`File ${fileName} already exists in Google Drive. Overwriting...`);
      const fileId = res.data.files[0].id;
      await drive.files.update({
        fileId: fileId,
        media: {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          body: fs.createReadStream(filePath)
        }
      });
      log(`Successfully updated existing Excel backup ${fileName} in Google Drive.`);
      return;
    }

    // Create new file
    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };
    const media = {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: fs.createReadStream(filePath)
    };

    await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id'
    });
    
    log(`Successfully uploaded ${fileName} to Google Drive.`);
  } catch (error) {
    log(`Error uploading to Google Drive: ${error.message}`);
    throw error;
  }
}

async function generateExcel() {
  log('Starting Excel Backup generation...');
  const prisma = new PrismaClient();

  try {
    const workbook = xlsx.utils.book_new();

    // 1. Fetch and format Products
    const products = await prisma.product.findMany({
      include: { category: true } 
    });
    const productData = products.map(p => ({
      'ID': p.id,
      'Name': p.name,
      'Barcode': p.barcode || '',
      'Category': p.category?.name || '',
      'Brand': p.brand || '',
      'Purchase Price': p.purchasePrice,
      'Selling Price': p.sellingPrice,
      'MRP': p.mrp,
      'Stock Quantity': p.stockQuantity,
      'Unit': p.unit,
      'Supplier': p.supplier || '',
      'Is Active': p.is_active ? 'Yes' : 'No'
    }));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(productData), 'Products');

    // 2. Customers
    const customers = await prisma.customer.findMany();
    const customerData = customers.map(c => ({
      'Name': c.name,
      'Phone': c.phone || '',
      'Loyalty Points': c.loyaltyPoints,
      'Total Spent': c.totalSpent,
      'Credit Balance': c.creditBalance,
      'Last Purchase': c.lastPurchaseDate ? c.lastPurchaseDate.toISOString().split('T')[0] : '',
      'Is Active': c.is_active ? 'Yes' : 'No'
    }));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(customerData), 'Customers');

    // 3. Orders (Summary)
    const orders = await prisma.order.findMany({
      include: { customer: true, creator: true }
    });
    const orderData = orders.map(o => ({
      'Invoice No': o.invoiceNo,
      'Date': o.createdAt.toISOString().split('T')[0],
      'Time': o.createdAt.toISOString().split('T')[1].split('.')[0],
      'Customer': o.customer?.name || 'Walk-in',
      'Cashier': o.creator?.name || '',
      'Subtotal': o.subtotal,
      'Discount': o.discount,
      'Tax': o.taxTotal,
      'Grand Total': o.grandTotal,
      'Payment Mode': o.paymentMode,
      'Status': o.status
    }));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(orderData), 'Orders');

    // 4. Order Items (Detailed sales)
    const orderItems = await prisma.orderItem.findMany({
      include: { order: true, product: true }
    });
    const orderItemData = orderItems.map(oi => ({
      'Invoice No': oi.order?.invoiceNo || '',
      'Date': oi.order?.createdAt ? oi.order.createdAt.toISOString().split('T')[0] : '',
      'Product Name': oi.product?.name || '',
      'Quantity': oi.quantity,
      'Price': oi.price,
      'Discount': oi.discount,
      'Tax Amount': oi.taxAmount,
      'Total': oi.total
    }));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(orderItemData), 'Order Items');

    // 5. Expenses
    const expenses = await prisma.expense.findMany();
    const expenseData = expenses.map(e => ({
      'Date': e.date.toISOString().split('T')[0],
      'Type': e.type,
      'Description': e.description || '',
      'Amount': e.amount
    }));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(expenseData), 'Expenses');

    // 6. Suppliers
    const suppliers = await prisma.supplier.findMany();
    const supplierData = suppliers.map(s => ({
      'Name': s.name,
      'Phone': s.phone || '',
      'Email': s.email || '',
      'GST No': s.gstNo || '',
      'Opening Balance': s.openingBalance,
      'Is Active': s.is_active ? 'Yes' : 'No'
    }));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(supplierData), 'Suppliers');

    // Write file
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `excel-backup-${dateStr}.xlsx`;
    const filePath = path.join(BACKUP_DIR, fileName);

    xlsx.writeFile(workbook, filePath);
    log(`Excel file successfully created at ${filePath}`);

    // Upload to Google Drive
    await uploadToGoogleDrive(filePath, fileName);

    log('Excel Backup process completed successfully.');
  } catch (error) {
    log(`Error generating Excel backup: ${error.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

generateExcel();
