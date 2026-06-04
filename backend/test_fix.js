const axios = require('axios');

async function test() {
  const API = 'http://localhost:5000/api';
  
  try {
    // 1. Login as Admin to get token
    console.log('Logging in...');
    const loginRes = await axios.post(`${API}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    const token = loginRes.data.token;
    console.log('✅ Logged in');

    const config = { headers: { Authorization: `Bearer ${token}` } };

    // 2. Add first product with empty barcode
    console.log('Adding product 1 (empty barcode)...');
    await axios.post(`${API}/products`, {
      name: 'Test Product 1',
      barcode: '',
      purchasePrice: 10,
      sellingPrice: 15,
      stockQuantity: 10
    }, config);
    console.log('✅ Product 1 added');

    // 3. Add second product with empty barcode (This was failing)
    console.log('Adding product 2 (empty barcode)...');
    await axios.post(`${API}/products`, {
      name: 'Test Product 2',
      barcode: '',
      purchasePrice: 20,
      sellingPrice: 25,
      stockQuantity: 20
    }, config);
    console.log('✅ Product 2 added (Fix confirmed!)');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data?.error || error.message);
  }
}

test();
