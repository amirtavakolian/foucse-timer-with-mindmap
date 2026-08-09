import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getFilePathForKey(key: string): string {
  const cleanKey = key
    .replace('win_focus_timer_', '')
    .replace('focustime_', '')
    .replace('_v1', '');

  let filename = `${cleanKey}.json`;
  if (cleanKey === 'conns') filename = 'mindmap_connections.json';
  if (cleanKey === 'nodes') filename = 'mindmap_nodes.json';

  if (cleanKey === 'mindmap_nodes' || cleanKey === 'nodes') filename = 'mindmap_nodes.json';
  if (cleanKey === 'mindmap_connections' || cleanKey === 'conns' || cleanKey === 'mindmap_conns') filename = 'mindmap_connections.json';
  if (cleanKey === 'interval_reports' || cleanKey === 'intervals') filename = 'interval_reports.json';

  return path.join(DATA_DIR, filename);
}

// API Routes
app.get('/api/storage/:key', (req, res) => {
  try {
    const filePath = getFilePathForKey(req.params.key);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return res.json(JSON.parse(content));
    }
    return res.status(404).json({ error: 'File not found' });
  } catch (err) {
    console.error('Error reading storage file:', err);
    return res.status(500).json({ error: 'Failed to read file' });
  }
});

app.post('/api/storage/:key', (req, res) => {
  try {
    const filePath = getFilePathForKey(req.params.key);
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2), 'utf-8');
    return res.json({ success: true, file: path.basename(filePath) });
  } catch (err) {
    console.error('Error writing storage file:', err);
    return res.status(500).json({ error: 'Failed to write file' });
  }
});

// Export all data endpoint
app.get('/api/storage/export/all', (_req, res) => {
  try {
    const files = fs.readdirSync(DATA_DIR);
    const allData: Record<string, unknown> = {};
    files.forEach((file) => {
      if (file.endsWith('.json')) {
        const name = file.replace('.json', '');
        const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8');
        try {
          allData[name] = JSON.parse(content);
        } catch {
          allData[name] = content;
        }
      }
    });
    return res.json(allData);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to export data' });
  }
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ['**/data/**', '**/*.json'],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

start();
