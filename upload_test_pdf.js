const fs = require('fs');
const path = require('path');
const http = require('http');

const filePath = path.join(__dirname, 'test_rag_manga7734.pdf');
const fileData = fs.readFileSync(filePath);
const boundary = '----FormBoundary' + Date.now();

const parts = [];

// pmo_id field
parts.push(
  `--${boundary}\r\n` +
  `Content-Disposition: form-data; name="pmo_id"\r\n\r\n` +
  `999999\r\n`
);

// file field
parts.push(
  `--${boundary}\r\n` +
  `Content-Disposition: form-data; name="file"; filename="test_rag_manga7734.pdf"\r\n` +
  `Content-Type: application/pdf\r\n\r\n`
);

const ending = `\r\n--${boundary}--\r\n`;

const headerBuf = Buffer.from(parts.join(''), 'utf-8');
const endBuf = Buffer.from(ending, 'utf-8');
const body = Buffer.concat([headerBuf, fileData, endBuf]);

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/knowledge/upload?token=ManejoOrgToken',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
    'Content-Length': body.length
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`HTTP Status: ${res.statusCode}`);
    console.log(`Response: ${data}`);
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.write(body);
req.end();
