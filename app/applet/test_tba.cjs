const https = require('https');
require('dotenv').config();

const options = {
  hostname: 'www.thebluealliance.com',
  port: 443,
  path: '/api/v3/match/2024cnsh_qm1',
  method: 'GET',
  headers: {
    'X-TBA-Auth-Key': process.env.VITE_TBA_API_KEY
  }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(JSON.parse(data).score_breakdown.red);
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
