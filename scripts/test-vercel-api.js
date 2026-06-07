const axios = require('axios');

async function test() {
  const baseURL = 'https://judes-kitchen-pos-frontend.vercel.app/api';
  console.log(`Connecting to ${baseURL}...`);
  try {
    const loginRes = await axios.post(`${baseURL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    const token = loginRes.data.token;
    console.log('Login successful! Token acquired.');
    
    const categoriesRes = await axios.get(`${baseURL}/categories`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`Categories count: ${categoriesRes.data.length}`);
    console.log('Categories:', categoriesRes.data.map(c => c.name));
    
    const productsRes = await axios.get(`${baseURL}/products?activeOnly=true`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`Products count: ${productsRes.data.length}`);
    console.log('Sample Products:', productsRes.data.slice(0, 5).map(p => `${p.name} (${p.sellingPrice})`));
  } catch (err) {
    console.error('Error during Vercel API test:', err.message);
    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', err.response.data);
    }
  }
}

test();
