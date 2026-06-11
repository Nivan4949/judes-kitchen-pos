const axios = require('axios');
const api = axios.create({ baseURL: 'http://localhost:5000/api' });

async function run() {
  const start = Date.now();
  const kotItems = [{
    productId: 'test-prod-123',
    name: 'Test Item',
    quantity: 1,
    price: 100,
    notes: null,
    variant: null,
    modifiers: []
  }];

  try {
    const res = await api.post('/kots', {
      orderId: 'isolated-test-order-' + Date.now(),
      tableId: 'test-table-123',
      tableName: 'T-1',
      waiterName: 'Test',
      orderType: 'Dine-in',
      items: kotItems
    });
    console.log(`Standalone KOT creation took: ${Date.now() - start}ms`);
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}
run();
