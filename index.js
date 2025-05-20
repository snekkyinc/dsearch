const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pLimit = require('p-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins (adjust if you want to restrict)
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Limits and settings tuned for low CPU & RAM usage on Render 512MB/0.1CPU
const MAX_CONCURRENT = 5;         // Only 5 parallel HTTP requests max
const MAX_FOUND = 50;             // Stop after finding 50 valid URLs
const REQUEST_TIMEOUT = 2500;     // 2.5 seconds timeout per request

// Load dictionary once on startup
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
  const baseUrl = site.endsWith('/') ? site : site + '/';

  console.log(`Scan started for: ${baseUrl}`);

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
          validateStatus: null, // don’t throw on non-200
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ScannerBot/1.0)',
            'Accept': '*/*',
          },
        });

        if (response.status === 200) {
          foundFiles.push(url);
          console.log(`Found: ${url}`);
        }
      } catch (err) {
        // Fail quietly on timeout or network errors, no stress
      }
    })
  );

  await Promise.all(tasks);

  console.log(`Scan finished for: ${baseUrl} - found ${foundFiles.length} files`);

  res.json({
    files: foundFiles,
    message: stoppedEarly ? `Hit max limit of ${MAX_FOUND} files, stopping.` : `Scanned all ${commonList.length} entries.`,
  });
});

// Health check route (optional)
app.get('/', (req, res) => {
  res.send('URL Guesser backend alive and chillin.');
});

app.listen(PORT, () => {
  console.log(`Scanner backend lit on port ${PORT}, running chill mode.`);
});

