const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/expand', async (req, res) => {
    const shortUrl = req.query.url;
    if (!shortUrl) {
        return res.json({ error: 'Please provide a URL' });
    }
    try {
        const response = await axios.get(shortUrl, {
            maxRedirects: 10,
            validateStatus: function (status) {
                return status >= 200 && status < 400;
            }
        });
        const finalUrl = response.request.res.responseUrl || shortUrl;
        res.json({
            original: shortUrl,
            expanded: finalUrl,
            status: response.status
        });
    } catch (error) {
        res.json({
            error: 'Failed to expand URL',
            details: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
