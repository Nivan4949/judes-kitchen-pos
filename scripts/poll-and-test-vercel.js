const axios = require('axios');

async function main() {
  const baseURL = 'https://judes-kitchen-pos-frontend.vercel.app/api';
  console.log('Polling Vercel deployment status and testing endpoints...');
  
  let deployed = false;
  for (let i = 0; i < 30; i++) {
    try {
      const healthRes = await axios.get(`${baseURL}/health`);
      console.log(`[Attempt ${i+1}] Health Check:`, healthRes.data);
      
      // If the dbUrl has the ap-northeast-2 Korea address and build completes, check login
      if (healthRes.data.dbUrl) {
        console.log('✨ New deployment is active on Vercel!');
        deployed = true;
        break;
      }
    } catch (err) {
      console.log(`[Attempt ${i+1}] Error: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 6000));
  }

  if (!deployed) {
    console.error('🛑 Timeout waiting for Vercel deployment.');
    return;
  }

  console.log('--- Logging in and Fetching categories and products ---');
  try {
    const loginRes = await axios.post(`${baseURL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    const token = loginRes.data.token;
    console.log('✅ Login successful!');

    const categoriesRes = await axios.get(`${baseURL}/categories`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Categories:', categoriesRes.data.map(c => c.name));

    const productsRes = await axios.get(`${baseURL}/products?activeOnly=true`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`Live Products in Vercel DB: ${productsRes.data.length}`);
    productsRes.data.forEach(p => {
      console.log(`- ${p.name} (${p.category?.name || 'N/A'}): ₹${p.sellingPrice} [Barcode: ${p.barcode}]`);
    });
  } catch (err) {
    console.error('Error testing Vercel API:', err.message);
    if (err.response) {
      console.error('Response:', err.response.data);
    }
  }
}

main();
