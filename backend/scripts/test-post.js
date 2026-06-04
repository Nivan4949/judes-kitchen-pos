async function testOrder() {
  try {
    const loginRes = await fetch('https://freshnaad.vercel.app/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@123' })
    });
    const { token } = await loginRes.json();
    if (!token) throw new Error('Login failed');

    const orderData = {
      id: "test-uuid-1234",
      invoiceNo: "99999",
      orderItems: [
        {
          productId: "115fe868-b8ce-4122-b5e1-9556cdedab41", // Need a real product ID ideally, but let's see what the backend does
          quantity: 1,
          price: 100,
          mrp: 100,
          gstRate: 0,
          total: 100
        }
      ],
      subtotal: 100,
      taxTotal: 0,
      grandTotal: 100,
      roundedTotal: 100,
      savings: 0,
      amountPaid: 100,
      balance: 0,
      paymentMode: "CASH",
      discount: 0,
      loyaltyPointsRedeemed: 0,
      customerId: null,
      userName: 'admin',
      creatorId: null,
      createdAt: new Date().toISOString()
    };

    const orderRes = await fetch('https://freshnaad.vercel.app/api/orders', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify(orderData)
    });
    
    if (!orderRes.ok) {
        const err = await orderRes.json();
        console.error('ORDER FAILED:', err);
    } else {
        const order = await orderRes.json();
        console.log('ORDER SUCCESS:', order);
    }
  } catch (e) {
    console.error(e);
  }
}
testOrder();
