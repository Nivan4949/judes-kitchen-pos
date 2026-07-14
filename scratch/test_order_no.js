const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// The logic we wrote:
async function getNextOrderNo(tx, createdAt) {
  const dt = new Date(createdAt);
  
  // Create a copy to calculate today's 5:00 AM local time boundary
  const today5AM = new Date(dt);
  today5AM.setHours(5, 0, 0, 0);
  
  let workingDayStart = new Date(today5AM);
  if (dt < today5AM) {
    workingDayStart.setDate(workingDayStart.getDate() - 1);
  }
  
  const maxOrder = await tx.order.findFirst({
    where: {
      createdAt: {
        gte: workingDayStart
      },
      orderNo: {
        not: null
      }
    },
    orderBy: {
      orderNo: 'desc'
    },
    select: {
      orderNo: true
    }
  });
  
  return (maxOrder?.orderNo || 0) + 1;
}

async function run() {
  try {
    console.log('Starting verification test for orderNo generation...');
    
    // We will simulate dates:
    // Let's use today's 10:00 AM
    const date1 = new Date();
    date1.setHours(10, 0, 0, 0);
    
    // Today's 11:00 AM
    const date2 = new Date();
    date2.setHours(11, 0, 0, 0);
    
    // Tomorrow's 2:00 AM (still same working day)
    const date3 = new Date();
    date3.setDate(date3.getDate() + 1);
    date3.setHours(2, 0, 0, 0);
    
    // Tomorrow's 6:00 AM (next working day!)
    const date4 = new Date();
    date4.setDate(date4.getDate() + 1);
    date4.setHours(6, 0, 0, 0);
    
    console.log('Simulating Order 1 at:', date1.toString());
    let nextNo1;
    await prisma.$transaction(async (tx) => {
      nextNo1 = await getNextOrderNo(tx, date1);
    });
    console.log('Order 1 will get number:', nextNo1);

    // We can run a transaction to create a test order at date1
    const testOrder1 = await prisma.$transaction(async (tx) => {
      const orderNo = await getNextOrderNo(tx, date1);
      const order = await tx.order.create({
        data: {
          invoiceNo: 'TEST-N1-' + Date.now(),
          orderNo: orderNo,
          subtotal: 100,
          discount: 0,
          taxTotal: 0,
          grandTotal: 100,
          paymentMode: 'CASH',
          status: 'COMPLETED',
          createdAt: date1
        }
      });
      return order;
    });
    console.log('Created test order 1 with orderNo:', testOrder1.orderNo, 'createdAt:', testOrder1.createdAt);

    // Now, check what order No date2 (11:00 AM today) gets. It should be testOrder1.orderNo + 1
    const testOrder2 = await prisma.$transaction(async (tx) => {
      const orderNo = await getNextOrderNo(tx, date2);
      const order = await tx.order.create({
        data: {
          invoiceNo: 'TEST-N2-' + Date.now(),
          orderNo: orderNo,
          subtotal: 100,
          discount: 0,
          taxTotal: 0,
          grandTotal: 100,
          paymentMode: 'CASH',
          status: 'COMPLETED',
          createdAt: date2
        }
      });
      return order;
    });
    console.log('Created test order 2 with orderNo:', testOrder2.orderNo, 'createdAt:', testOrder2.createdAt);
    if (testOrder2.orderNo !== testOrder1.orderNo + 1) {
      throw new Error(`Order 2 got incorrect number ${testOrder2.orderNo}, expected ${testOrder1.orderNo + 1}`);
    }

    // Now, check what order No date3 (2:00 AM tomorrow) gets. It should be testOrder2.orderNo + 1 because it's before 5:00 AM
    const testOrder3 = await prisma.$transaction(async (tx) => {
      const orderNo = await getNextOrderNo(tx, date3);
      const order = await tx.order.create({
        data: {
          invoiceNo: 'TEST-N3-' + Date.now(),
          orderNo: orderNo,
          subtotal: 100,
          discount: 0,
          taxTotal: 0,
          grandTotal: 100,
          paymentMode: 'CASH',
          status: 'COMPLETED',
          createdAt: date3
        }
      });
      return order;
    });
    console.log('Created test order 3 with orderNo:', testOrder3.orderNo, 'createdAt:', testOrder3.createdAt);
    if (testOrder3.orderNo !== testOrder2.orderNo + 1) {
      throw new Error(`Order 3 got incorrect number ${testOrder3.orderNo}, expected ${testOrder2.orderNo + 1}`);
    }

    // Now, check what order No date4 (6:00 AM tomorrow) gets. It should be 1, because it starts a new working day (after 5:00 AM)
    const testOrder4 = await prisma.$transaction(async (tx) => {
      const orderNo = await getNextOrderNo(tx, date4);
      const order = await tx.order.create({
        data: {
          invoiceNo: 'TEST-N4-' + Date.now(),
          orderNo: orderNo,
          subtotal: 100,
          discount: 0,
          taxTotal: 0,
          grandTotal: 100,
          paymentMode: 'CASH',
          status: 'COMPLETED',
          createdAt: date4
        }
      });
      return order;
    });
    console.log('Created test order 4 with orderNo:', testOrder4.orderNo, 'createdAt:', testOrder4.createdAt);
    if (testOrder4.orderNo !== 1) {
      throw new Error(`Order 4 got incorrect number ${testOrder4.orderNo}, expected 1`);
    }

    console.log('Clean up test orders...');
    await prisma.order.deleteMany({
      where: {
        invoiceNo: {
          startsWith: 'TEST-N'
        }
      }
    });
    console.log('✅ ALL TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
