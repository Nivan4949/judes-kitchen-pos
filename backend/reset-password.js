const axios = require('axios');

async function testPassword() {
  try {
    const res = await axios.post('http://localhost:5000/api/auth/change-password', {
      userId: '0266af20-efe7-4e21-a96e-2589f05b9d8d', // from earlier trace
      currentPassword: 'newpassword123',
      newPassword: 'admin123'
    });
    console.log('Success:', res.data);
  } catch (err) {
    console.error('Failed:', err.response?.data || err.message);
  }
}

testPassword();
