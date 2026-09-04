const http = require('node:http');

function startServer(app) {
  const port = Number(process.env.PORT) || 3000;
  const server = http.createServer(app);

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
