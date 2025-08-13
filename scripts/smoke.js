const http = require('http');

function hit(path) {
  return new Promise((resolve) => {
    http.get(`http://localhost:${process.env.PORT||5000}${path}`, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        console.log('GET', path, res.statusCode, body.slice(0, 200));
        resolve();
      });
    }).on('error', (e) => {
      console.error('ERR', path, e.message);
      resolve();
    });
  });
}

(async () => {
  await hit('/api/health');
  await hit('/api/does-not-exist');
})();
