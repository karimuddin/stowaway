// Static file server for the Stowaway web app
const http = require('http');
const fs   = require('fs');
const path = require('path');

const APP_DIR = path.join(__dirname, '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function startAppServer(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath = req.url.split('?')[0];
      if (urlPath === '/') urlPath = '/index.html';

      const filePath = path.resolve(APP_DIR, '.' + urlPath);

      // Prevent directory traversal
      if (!filePath.startsWith(APP_DIR)) {
        res.writeHead(403); res.end('Forbidden'); return;
      }

      const ext = path.extname(filePath);
      const contentType = MIME[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, data) => {
        if (err) {
          // SPA fallback to index.html for unknown routes
          fs.readFile(path.join(APP_DIR, 'index.html'), (e, d) => {
            if (e) { res.writeHead(404); res.end('Not found'); return; }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(d);
          });
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    });

    server.listen(port, '127.0.0.1', () => resolve(server));
    server.on('error', reject);

    ['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, () => { server.close(); }));
  });
}

module.exports = { startAppServer };
