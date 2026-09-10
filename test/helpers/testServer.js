const http = require('node:http');

function testServer(app) {
  if (typeof app !== 'function') {
    return Promise.reject(new TypeError('Express app must be callable'));
  }

  app.set('env', 'test');
  const server = http.createServer(app);

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const liveHub = typeof app.attachLiveHub === 'function'
        ? app.attachLiveHub(server, [baseUrl])
        : null;

      resolve({
        baseUrl,
        close: async () => {
          if (liveHub) await liveHub.close();
          await new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }

              closeResolve();
            });
          });
        }
      });
    });
  });
}

module.exports = testServer;
