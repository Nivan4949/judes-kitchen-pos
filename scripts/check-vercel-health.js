const axios = require('axios');

async function main() {
  const url = 'https://judes-kitchen-pos-frontend.vercel.app/api/health';
  console.log(`Polling ${url}...`);
  for (let i = 0; i < 20; i++) {
    try {
      const res = await axios.get(url);
      console.log(`[Attempt ${i+1}] Status: ${res.status}`);
      console.log('Response:', res.data);
      if (res.data.dbUrl) {
        console.log('DB URL found! Exit.');
        break;
      }
    } catch (err) {
      console.log(`[Attempt ${i+1}] Error: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 6000));
  }
}

main();
