const http = require('node:http');

function testServer(app) {
  if (typeof app !== 'function') {
    return Promise.reject(new TypeError('Express app must be callable'));
  }

  const server = http.createServer(app);

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((closeResolve, closeReject) => {
          server.close((error) => {
            if (error) {
              closeReject(error);
              return;
            }

            closeResolve();
          });
        })
      });
    });
  });
}

module.exports = testServer;
