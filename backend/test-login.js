const axios = require('axios');
const fs = require('fs');

async function testLogin() {
  try {
    const res = await axios.post('http://localhost:5000/api/auth/login', {
      username: 'admin',
      password: 'admin123',
      deviceId: 'test-device'
    });
    console.log('Login Success:', res.data);
  } catch (err) {
    fs.writeFileSync('login-error.json', JSON.stringify(err.response?.data, null, 2));
    console.log('Login Failed, check log.');
  }
}

testLogin();
