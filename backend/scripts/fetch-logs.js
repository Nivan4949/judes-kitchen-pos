async function checkLogs() {
  try {
    const loginRes = await fetch('https://freshnaad.vercel.app/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@123' })
    });
    const { token } = await loginRes.json();
    if (!token) throw new Error('Login failed');

    const logRes = await fetch('https://freshnaad.vercel.app/api/reports/debug-logs', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const logs = await logRes.json();
    console.log(JSON.stringify(logs, null, 2));
  } catch (e) {
    console.error(e);
  }
}
checkLogs();
