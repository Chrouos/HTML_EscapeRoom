const http = require('node:http');

function configuredOrigins(port) {
  const configured = String(process.env.LIVE_ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  return configured.length > 0 ? configured : [`http://localhost:${port}`];
}

function startServer(app, options = {}) {
  const port = options.port ?? (Number(process.env.PORT) || 3000);
  const server = http.createServer(app);
  server.liveHub = app.attachLiveHub(
    server,
    options.allowedOrigins || configuredOrigins(port)
  );

  server.listen(port, () => {
    console.log(`ESCAPE ROOM started on port ${port}.`);
    console.log(`http://localhost:${port}/`);
  });

  return server;
}

if (require.main === module) {
  const app = require('./app');
  startServer(app);
}

module.exports = { startServer };
