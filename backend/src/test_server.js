const express = require('express');
const app = express();
app.use((req, res) => {
    res.send('Server is alive via middleware');
});
app.listen(5001, () => console.log('Test server on 5001'));
