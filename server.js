const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

let pg = null;
try { pg = require('pg'); } catch (error) { pg = null; }

const root = __dirname;
const publicDir = path.join(root, 'outputs');
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(root, 'data');
const dbPath = path.join(dataDir, 'state.json');
const seedPath = path.join(root, 'data', 'state.json');
const backupDir = path.join(dataDir, 'backups');
const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl && pg ? new pg.Pool({ connectionString: databaseUrl }) : null;
const port = Number(process.env.PORT || 4174);
const host = process.env.HOST || '0.0.0.0';

const fallbackState = { clients: [], products: [], trucks: [], tractorTrailers: [], drivers: [], helpers: [], trash: [], auditLog: [], orders: [] };
const requiredCollections = ['clients', 'products', 'trucks', 'tractorTrailers', 'drivers', 'helpers', 'trash', 'auditLog', 'orders'];

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png'
};

function normalizeState(state = {}) {
  const clean = { ...fallbackState, ...state };
  requiredCollections.forEach((key) => { if (!Array.isArray(clean[key])) clean[key] = []; });
  return clean;
}

async function readSeedState() {
  try {
    return normalizeState(JSON.parse(await fs.readFile(seedPath, 'utf8')));
  } catch (error) {
    return fallbackState;
  }
}

async function ensureDatabase() {
  if (!pool) return;
  await pool.query('CREATE TABLE IF NOT EXISTS transporte_state (id INTEGER PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  await pool.query('CREATE TABLE IF NOT EXISTS transporte_backups (id BIGSERIAL PRIMARY KEY, reason TEXT NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  const result = await pool.query('SELECT id FROM transporte_state WHERE id = 1');
  if (result.rowCount === 0) {
    await pool.query('INSERT INTO transporte_state (id, data) VALUES (1, $1)', [await readSeedState()]);
  }
}

async function ensureStateFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dbPath);
  } catch (error) {
    await fs.writeFile(dbPath, JSON.stringify(await readSeedState(), null, 2), 'utf8');
  }
}

async function readState() {
  if (pool) {
    await ensureDatabase();
    const result = await pool.query('SELECT data FROM transporte_state WHERE id = 1');
    return normalizeState(result.rows[0]?.data);
  }
  await ensureStateFile();
  return normalizeState(JSON.parse(await fs.readFile(dbPath, 'utf8')));
}

async function createBackup(state, reason = 'manual') {
  const clean = normalizeState(state);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.mkdir(backupDir, { recursive: true });
  await fs.writeFile(path.join(backupDir, 'transporte-' + reason + '-' + stamp + '.json'), JSON.stringify(clean, null, 2), 'utf8');
  if (pool) {
    await ensureDatabase();
    await pool.query('INSERT INTO transporte_backups (reason, data) VALUES ($1, $2)', [reason, clean]);
  }
}

async function writeState(state) {
  const clean = normalizeState(state);
  const previous = await readState().catch(() => null);
  if (previous) await createBackup(previous, 'before-write');
  if (pool) {
    await ensureDatabase();
    await pool.query('UPDATE transporte_state SET data = $1, updated_at = NOW() WHERE id = 1', [clean]);
    return clean;
  }
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dbPath, JSON.stringify(clean, null, 2), 'utf8');
  return clean;
}

async function readJsonBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  if (!body) return null;
  return JSON.parse(body);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

function localUrls() {
  return Object.values(os.networkInterfaces()).flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => 'http://' + entry.address + ':' + port + '/');
}

function storageMode() {
  if (pool) return 'postgres';
  if (process.env.RAILWAY_VOLUME_MOUNT_PATH) return 'volume-file';
  return 'local-file';
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/state' && req.method === 'GET') {
      sendJson(res, 200, await readState());
      return;
    }
    if (url.pathname === '/api/state' && req.method === 'PUT') {
      const state = await readJsonBody(req);
      if (!state || !Array.isArray(state.clients) || !Array.isArray(state.orders)) {
        sendJson(res, 400, { error: 'Formato de datos invalido' });
        return;
      }
      await writeState(state);
      sendJson(res, 200, { ok: true, storage: storageMode() });
      return;
    }
    if (url.pathname === '/api/backup' && req.method === 'GET') {
      const state = await readState();
      await createBackup(state, 'manual');
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Disposition': 'attachment; filename="transporte-backup-' + new Date().toISOString().slice(0, 10) + '.json"'
      });
      res.end(JSON.stringify(state, null, 2));
      return;
    }
    if (url.pathname === '/api/info' && req.method === 'GET') {
      sendJson(res, 200, { storage: storageMode(), urls: ['http://127.0.0.1:' + port + '/', ...localUrls()] });
      return;
    }

    const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    if (requested.includes('..')) throw new Error('Ruta invalida');
    const file = path.join(publicDir, requested);
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (error) {
    if (!res.headersSent) res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No encontrado');
  }
});

(async () => {
  if (pool) await ensureDatabase(); else await ensureStateFile();
  server.listen(port, host, () => {
    console.log('Servidor listo: http://127.0.0.1:' + port + '/');
    console.log('Almacenamiento: ' + storageMode());
    for (const url of localUrls()) console.log('Red local: ' + url);
  });
})().catch((error) => {
  console.error('No se pudo iniciar el servidor', error);
  process.exit(1);
});
