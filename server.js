const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

const root = __dirname;
const publicDir = path.join(root, 'outputs');
const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(root, 'data');
const dbPath = path.join(dataDir, 'state.json');
const port = Number(process.env.PORT || 4174);
const host = process.env.HOST || '0.0.0.0';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

const initialState = {
  "clients": [
    {
      "id": "c5-mr184uk3",
      "name": "Myriam Zuñiga",
      "contact": "+569telefono",
      "phone": "telefono",
      "city": "San Javier"
    },
    {
      "id": "c2-mr187tg8",
      "name": "Yo Claudio Ruta 5",
      "contact": "Supervisor Ruta 5 Parral",
      "phone": "+569telefono",
      "city": "Parral"
    },
    {
      "id": "c3-mr188f0i",
      "name": "Yo Claudio Ciudad Parral",
      "contact": "Supervisora Yo Claudio Ciudad",
      "phone": "+569",
      "city": "Parral"
    },
    {
      "id": "c4-mr18e355",
      "name": "Rodolfo",
      "contact": "Rodolfo",
      "phone": "+569",
      "city": "Limache"
    }
  ],
  "trucks": [
    {
      "id": "t1-mr189ebo",
      "plate": "JAC",
      "model": "JAC Camioneta",
      "capacity": "2500",
      "status": "Disponible"
    },
    {
      "id": "t2-mr189nfq",
      "plate": "Mercedes",
      "model": "Mercedes Camión",
      "capacity": "5000",
      "status": "Disponible"
    },
    {
      "id": "t3-mr18ab5s",
      "plate": "Ford",
      "model": "Ford Ranger Gris",
      "capacity": "1000",
      "status": "Mantencion"
    }
  ],
  "tractorTrailers": [
    {
      "id": "tc1",
      "type": "Tractor",
      "plate": "TR-001",
      "model": "John Deere 5075E",
      "capacity": "75 HP",
      "status": "Disponible"
    },
    {
      "id": "tc2",
      "type": "Coloso",
      "plate": "CO-014",
      "model": "Coloso agricola",
      "capacity": "8 ton",
      "status": "Arrendado"
    }
  ],
  "drivers": [
    {
      "id": "d3",
      "name": "Marcelo Ortega",
      "phone": "+56 9 72516603",
      "license": "A5",
      "status": "Disponible"
    }
  ],
  "helpers": [
    {
      "id": "p1-mr18c5n7",
      "name": "Camilo Muñoz",
      "phone": "74740570",
      "status": "Disponible"
    },
    {
      "id": "p2-mr18cmpi",
      "name": "Ricardo Carter",
      "phone": "+569",
      "status": "Disponible"
    }
  ],
  "orders": [
    {
      "id": "o4-mr18ogm9",
      "code": "PED-1004",
      "origin": "Melozal",
      "date": "2026-07-01",
      "truckId": "t2-mr189nfq",
      "driverId": "d3",
      "status": "Programado",
      "stops": [
        {
          "clientId": "c4-mr18e355",
          "destination": "Limache",
          "bottles": "",
          "drums": "",
          "collectPayment": false,
          "collectionAmount": "",
          "paymentStatus": "No aplica",
          "notes": ""
        }
      ],
      "helperIds": [
        "p1-mr18c5n7"
      ],
      "settlement": {
        "finished": false,
        "driverSettled": false,
        "helpersSettled": false,
        "returnedAmount": "",
        "notes": ""
      }
    },
    {
      "id": "o2-mr18vgyj",
      "code": "PED-1002",
      "origin": "Melozal",
      "date": "2026-07-02",
      "truckId": "t2-mr189nfq",
      "driverId": "d3",
      "status": "Programado",
      "stops": [
        {
          "clientId": "c2-mr187tg8",
          "destination": "Parral",
          "bottles": "",
          "drums": "",
          "collectPayment": false,
          "collectionAmount": "",
          "paymentStatus": "No aplica",
          "notes": ""
        }
      ],
      "helperIds": [],
      "settlement": {
        "finished": false,
        "driverSettled": false,
        "helpersSettled": false,
        "returnedAmount": "",
        "notes": ""
      }
    }
  ]
};

async function ensureStateFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dbPath);
  } catch (error) {
    await fs.writeFile(dbPath, JSON.stringify(initialState, null, 2), 'utf8');
  }
}

async function readJsonBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  if (!body) return null;
  return JSON.parse(body);
}

async function readState() {
  return JSON.parse(await fs.readFile(dbPath, 'utf8'));
}

async function writeState(state) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dbPath, JSON.stringify(state, null, 2), 'utf8');
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
      sendJson(res, 200, { ok: true });
      return;
    }
    if (url.pathname === '/api/info' && req.method === 'GET') {
      sendJson(res, 200, { urls: ['http://127.0.0.1:' + port + '/', ...localUrls()] });
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

ensureStateFile().then(() => {
  server.listen(port, host, () => {
    console.log('Servidor listo: http://127.0.0.1:' + port + '/');
    console.log('Datos en: ' + dbPath);
    for (const url of localUrls()) console.log('Red local: ' + url);
  });
}).catch((error) => {
  console.error('No se pudo iniciar el archivo de datos', error);
  process.exit(1);
});
