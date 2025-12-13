import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 8000;

// Serve static files
app.use(express.static(__dirname));
app.use(express.static(join(__dirname, 'assets')));
app.use(express.static(join(__dirname, 'samples')));

// Serve Tone.js from node_modules
app.use('/lib', express.static(join(__dirname, 'node_modules')));

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Guitar4 server running on http://localhost:${PORT}`);
});
