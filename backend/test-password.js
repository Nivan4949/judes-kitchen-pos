const axios = require('axios');
const fs = require('fs');

async function testPassword() {
  try {
    const res = await axios.post('http://localhost:5000/api/auth/change-password', {
      userId: '0266af20-efe7-4e21-a96e-2589f05b9d8d', // from earlier trace
      currentPassword: 'admin123',
      newPassword: 'newpassword123'
    });
    console.log('Success:', res.data);
  } catch (err) {
    console.error('Failed:', err.response?.data || err.message);
  }
}

testPassword();
