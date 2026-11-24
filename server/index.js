import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MISSIONS } from '../src/game/missions.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '..', 'dist');
const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'iron-front',
    missions: MISSIONS.length,
    uptime: Math.round(process.uptime()),
  });
});

// Mission metadata, read from the same module the client bundles.
app.get('/api/missions', (req, res) => {
  res.json({
    missions: MISSIONS.map((m) => ({
      id: m.id,
      name: m.name,
      code: m.code,
      difficulty: m.difficulty,
      brief: m.brief,
      enemyUnits: m.enemy.length,
      playerUnits: m.player.length,
    })),
  });
});

app.use(
  express.static(dist, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  })
);

// SPA fallback (works on both Express 4 and 5).
app.use((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.sendFile(path.join(dist, 'index.html'), (err) => {
    if (err) res.status(500).send('Client build missing. Run: npm run build');
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`IRON FRONT listening on 0.0.0.0:${PORT}`);
});
