'use strict';

var fs = require('node:fs');
var http = require('node:http');
var path = require('node:path');
var url = require('node:url');

var ROOT = __dirname;
var DEFAULT_STORE_DIR = path.join(ROOT, 'data', 'switches');
var storeDirOverride = process.env.SWITCHDRAW_STORE_DIR || '';
var PORT = Number(process.env.PORT) || 8080;

function getStoreDir() {
  return storeDirOverride || DEFAULT_STORE_DIR;
}

function setStoreDir(dir) {
  storeDirOverride = dir || '';
}
var MAX_BODY_BYTES = 20 * 1024 * 1024;

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function ensureStoreDir() {
  fs.mkdirSync(getStoreDir(), { recursive: true });
}

function sendJson(res, statusCode, payload) {
  var body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    var size = 0;

    req.on('data', function (chunk) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', function () {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    req.on('error', reject);
  });
}

function sanitizeIdPart(value) {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

function buildRecordId(devices) {
  var host = devices.length ? devices[0].hostname : 'switch';
  var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
  return stamp + '-' + sanitizeIdPart(host);
}

function recordPath(id) {
  if (!/^[a-z0-9-]+$/i.test(id)) {
    throw new Error('Invalid record id');
  }
  return path.join(getStoreDir(), id + '.json');
}

function stripDerivedFields(device) {
  var copy = Object.assign({}, device);
  delete copy.colorRegistry;
  return copy;
}

function summarizeRecord(record) {
  return {
    id: record.id,
    savedAt: record.savedAt,
    sourceFile: record.sourceFile,
    deviceCount: record.devices.length,
    hostnames: record.devices.map(function (device) { return device.hostname; })
  };
}

function listRecords() {
  ensureStoreDir();
  return fs.readdirSync(getStoreDir())
    .filter(function (name) { return name.endsWith('.json'); })
    .map(function (name) {
      var fullPath = path.join(getStoreDir(), name);
      var raw = fs.readFileSync(fullPath, 'utf8');
      return summarizeRecord(JSON.parse(raw));
    })
    .sort(function (a, b) {
      return String(b.savedAt).localeCompare(String(a.savedAt));
    });
}

function readRecord(id) {
  var fullPath = recordPath(id);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function writeRecord(payload) {
  if (!payload || !Array.isArray(payload.devices) || !payload.devices.length) {
    throw new Error('devices array is required');
  }

  var record = {
    id: buildRecordId(payload.devices),
    savedAt: new Date().toISOString(),
    sourceFile: payload.sourceFile || '',
    devices: payload.devices.map(stripDerivedFields)
  };

  ensureStoreDir();
  var fullPath = recordPath(record.id);
  if (fs.existsSync(fullPath)) {
    record.id = record.id + '-' + Date.now().toString(36);
    fullPath = recordPath(record.id);
  }

  fs.writeFileSync(fullPath, JSON.stringify(record, null, 2), 'utf8');
  return record;
}

function deleteRecord(id) {
  var fullPath = recordPath(id);
  if (!fs.existsSync(fullPath)) {
    return false;
  }
  fs.unlinkSync(fullPath);
  return true;
}

function serveStatic(reqPath, res) {
  var safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, '');
  var filePath = path.join(ROOT, safePath === path.sep ? 'index.html' : safePath);

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  var ext = path.extname(filePath).toLowerCase();
  var type = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(filePath).pipe(res);
}

function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/records') {
    sendJson(res, 200, { records: listRecords() });
    return;
  }

  var match = pathname.match(/^\/api\/records\/([^/]+)$/);
  if (match) {
    var id = decodeURIComponent(match[1]);

    if (req.method === 'GET') {
      var record = readRecord(id);
      if (!record) {
        sendJson(res, 404, { error: 'Record not found' });
        return;
      }
      sendJson(res, 200, record);
      return;
    }

    if (req.method === 'DELETE') {
      if (!deleteRecord(id)) {
        sendJson(res, 404, { error: 'Record not found' });
        return;
      }
      sendJson(res, 200, { ok: true });
      return;
    }
  }

  if (req.method === 'POST' && pathname === '/api/records') {
    readBody(req).then(function (body) {
      var payload = JSON.parse(body || '{}');
      var record = writeRecord(payload);
      sendJson(res, 201, summarizeRecord(record));
    }).catch(function (err) {
      sendJson(res, 400, { error: err.message });
    });
    return;
  }

  sendJson(res, 404, { error: 'API route not found' });
}

var server = http.createServer(function (req, res) {
  var parsed = url.parse(req.url, true);
  var pathname = parsed.pathname || '/';

  if (pathname.indexOf('/api/') === 0) {
    handleApi(req, res, pathname);
    return;
  }

  var staticPath = pathname === '/' ? '/index.html' : pathname;
  serveStatic(staticPath, res);
});

ensureStoreDir();

if (require.main === module) {
  server.listen(PORT, function () {
    console.log('SwitchDraw server running at http://localhost:' + PORT);
    console.log('Switch records stored in ' + getStoreDir());
  });
}

module.exports = {
  getStoreDir: getStoreDir,
  setStoreDir: setStoreDir,
  buildRecordId: buildRecordId,
  writeRecord: writeRecord,
  readRecord: readRecord,
  listRecords: listRecords,
  deleteRecord: deleteRecord,
  summarizeRecord: summarizeRecord
};
