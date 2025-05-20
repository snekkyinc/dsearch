const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pLimit = require('p-limit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const MAX_CONCURRENT = 5;         // low concurrency to save CPU
const MAX_FOUND = 50;             // stop at 50 found URLs
const REQUEST_TIMEOUT = 2500;     // quick timeout to save RAM and cpu

// Load your 5k common.txt dictionary once
const commonList = fs.readFileSync(path.join(__dirname, 'common.txt'), 'utf-8')
  .split('\n')
  .map(s => s.trim())
  .filter(Boolean);

const limit = pLimit(MAX_CONCURRENT);

app.post('/scan', async (req, res) => {
  const { site } = req.body;

  if (!site || !site.startsWith('http')) {
    return res.status(400).json({ error: 'Invalid site URL' });
  }

  let foundFiles = [];
  let stoppedEarly = false;
  let baseUrl = site.endsWith('/') ? site : site + '/';

  const tasks = commonList.map(word =>
    limit(async () => {
      if (foundFiles.length >= MAX_FOUND) {
        stoppedEarly = true;
        return;
      }

      const url = baseUrl + word;

      try {
        const response = await axios.get(url, {
          timeout: REQUEST_TIMEOUT,
          validateStatus: null,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ScannerBot/1.0)' },
        });

        if (response.status === 200) {
          foundFiles.push(url);
          console.log('Found:', url);
        }
      } catch {
        // silent fail on timeout or error, no biggie
      }
    })
  );

  await Promise.all(tasks);

  res.json({
    files: foundFiles,
    message: stoppedEarly ? `Hit max limit of ${MAX_FOUND} files, stopping.` : `Scanned all ${commonList.length} entries.`,
  });
});

app.listen(PORT, () => {
  console.log(`Scanner backend lit on port ${PORT}, running chill mode.`);
});
