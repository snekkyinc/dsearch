const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const MAX_FILES = 50;
const REQUEST_DELAY_MS = 150; // delay between requests to be polite

// Load common.txt into array on startup
const wordlistPath = path.join(__dirname, 'common.txt');
let wordlist = [];
try {
  const fileContent = fs.readFileSync(wordlistPath, 'utf-8');
  wordlist = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');
  console.log(`Loaded ${wordlist.length} entries from common.txt`);
} catch (err) {
  console.error('Error loading common.txt:', err.message);
  process.exit(1);
}

// Helper delay function
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

app.post('/scan', async (req, res) => {
  const { site } = req.body;
  if (!site || !site.startsWith('http')) {
    return res.status(400).json({ error: 'Invalid site URL' });
  }

  const foundFiles = [];
  const origin = new URL(site).origin;

  for (const word of wordlist) {
    if (foundFiles.length >= MAX_FILES) break;

    // Build URL guesses: try with /word and /word.html and /word.js
    const guesses = [
      `${origin}/${word}`,
      `${origin}/${word}.html`,
      `${origin}/${word}.js`,
      `${origin}/${word}/`, // folder variant
    ];

    for (const guessUrl of guesses) {
      if (foundFiles.length >= MAX_FILES) break;

      try {
        const resp = await axios.head(guessUrl, {
          timeout: 4000,
          validateStatus: () => true, // accept all status codes
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; URLGuesser/1.0)' },
        });

        if (resp.status === 200) {
          foundFiles.push(guessUrl);
          console.log(`Found: ${guessUrl}`);
        }
      } catch (err) {
        // ignore request errors
      }

      await delay(REQUEST_DELAY_MS);
    }
  }

  res.json({ files: foundFiles });
});

app.listen(PORT, () => {
  console.log(`URL Guesser backend listening on port ${PORT}`);
});
