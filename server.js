const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/expand', async (req, res) => {
    const shortUrl = req.query.url;
    if (!shortUrl) {
        return res.json({ error: 'Please provide a URL' });
    }

    try {
        let finalUrl = shortUrl;

        // 🎯 अगर लिंक मुश्किल (vplink या earnlinks) है, तो असली ब्राउज़र चलाओ
        if (shortUrl.includes('vplink.in') || shortUrl.includes('earnlinks.in')) {
            console.log('🚀 Tricky link detected, launching browser...');
            
            const browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage'
                ]
            });
            
            const page = await browser.newPage();
            
            // खुद को Real Browser बनाओ
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // पेज खोलो
            await page.goto(shortUrl, { waitUntil: 'networkidle2', timeout: 60000 });
            
            // 🔥 बटन ढूंढो और क्लिक करो (जादू यहीं है)
            await page.evaluate(() => {
                const allElements = document.querySelectorAll('a, button');
                for (let el of allElements) {
                    const text = el.innerText.toLowerCase();
                    // अगर बटन पर Continue, Get Link, Free Download, Proceed लिखा है तो क्लिक करो
                    if (text.includes('continue') || text.includes('get link') || text.includes('free download') || text.includes('proceed') || text.includes('click here')) {
                        el.click();
                        break;
                    }
                }
            });

            // 5 सेकंड इंतज़ार करो (बटन दबने के बाद लिंक आने के लिए)
            await new Promise(r => setTimeout(r, 5000));
            
            // आखिरी वाला लिंक (जहाँ पहुँच गए) पकड़ो
            finalUrl = page.url();
            await browser.close();
            console.log('✅ Final URL found:', finalUrl);
            
        } else {
            // साधारण लिंक (bit.ly, tinyurl) - पुराना तरीका
            console.log('⚡ Simple redirect link...');
            const response = await axios.get(shortUrl, {
                maxRedirects: 10,
                validateStatus: (status) => status >= 200 && status < 400,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            finalUrl = response.request.res.responseUrl || shortUrl;
        }

        res.json({
            original: shortUrl,
            expanded: finalUrl
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        res.json({
            error: 'Failed to expand URL',
            details: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
