const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Generic short link expander
async function expandShortLink(shortUrl) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    console.log(`Opening: ${shortUrl}`);
    await page.goto(shortUrl, { waitUntil: 'networkidle2', timeout: 50000 });

    let finalUrl = null;
    for (let i = 0; i < 10; i++) {
      const currentUrl = page.url();
      console.log(`Step ${i + 1}: ${currentUrl}`);

      if (isDirectDownloadLink(currentUrl)) {
        finalUrl = currentUrl;
        break;
      }

      const clicked = await tryClickAnyButton(page);
      if (clicked) {
        try { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }); } catch {}
      } else {
        await page.waitForTimeout(5000);
        const clicked2 = await tryClickAnyButton(page);
        if (clicked2) {
          try { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }); } catch {}
        } else {
          // Try to extract any file link from page
          finalUrl = await page.evaluate(() => {
            const anchors = document.querySelectorAll('a');
            const found = Array.from(anchors).find(a => {
              const h = a.href.toLowerCase();
              return h.includes('drive.google') || h.includes('mediafire') || h.includes('mega.nz') || h.includes('dropbox') || h.endsWith('.zip') || h.endsWith('.mp4') || h.endsWith('.mkv') || h.endsWith('.apk');
            });
            return found ? found.href : null;
          });
          if (finalUrl) break;
          break; // no more actions
        }
      }

      if (isDirectDownloadLink(page.url())) {
        finalUrl = page.url();
        break;
      }
    }

    if (!finalUrl) finalUrl = page.url();
    console.log(`Final: ${finalUrl}`);
    return finalUrl;
  } catch (err) {
    console.error(err);
    throw new Error('Expand failed: ' + err.message);
  } finally {
    await browser.close();
  }
}

function isDirectDownloadLink(url) {
  const lower = url.toLowerCase();
  return ['drive.google.com', 'mediafire.com', 'mega.nz', 'dropbox.com', '.zip', '.mp4', '.mkv', '.mp3', '.apk', '.rar', '.7z'].some(p => lower.includes(p));
}

async function tryClickAnyButton(page) {
  const selectors = [
    'a#downloadbtn', 'a.btn', 'button#download',
    'a[href*="download"]', 'a:has-text("Free Download")',
    'button:has-text("Continue")', 'a:has-text("Click Here")',
    'a:has-text("Get Link")', 'button:has-text("Get Link")',
    'a:has-text("Download Now")', 'button:has-text("Download Now")',
    'a[rel="nofollow"]', 'a.get-link', 'button.get-link',
    'a:has-text("Proceed")', 'button:has-text("Proceed")'
  ];
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el && await el.boundingBox()) {
        console.log('Clicking:', sel);
        await el.click();
        return true;
      }
    } catch {}
  }
  return false;
}

app.post('/expand', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ success: false, error: 'URL required' });
  try {
    const finalUrl = await expandShortLink(url);
    res.json({ success: true, finalUrl });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
