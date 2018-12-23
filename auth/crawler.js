// eslint-disable-next-line prefer-destructuring
const https = require('follow-redirects').https;

const querystring = require('querystring');

// const request = require('request');

const urls = require('../moodle/urls');

function parseTicket(data) {
  const matched = data.match(/ticket=(.*)"/);
  if (matched) {
    return matched[1];
  }
  return null;
}

module.exports.moodle = () => new Promise((resolve, reject) => {
  const req = https.get(`${urls.moodlePage}`, (res) => {
    res.setEncoding('utf8');
    res.on('data', (d) => {
      resolve(d);
    });
  });
  req.on('error', (e) => {
    reject(e);
  });
  req.end();
});

module.exports.check = ticket => new Promise((resolve, reject) => {
  const req = https.get(`${urls.moodleLogin}&ticket=${ticket}`, (res) => {
    res.setEncoding('utf8');
    res.on('data', (d) => {
      resolve(d);
    });
  });
  req.on('error', (e) => {
    reject(e);
  });
  req.end();
});

module.exports.crawl = (username, password) => new Promise((resolve, reject) => {
  const postData = querystring.stringify({
    service: urls.moodleLogin,
    username,
    password,
  });
  const options = {
    hostname: urls.portalDomain,
    port: 443,
    path: urls.casLoginPath,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const req = https.request(options, (res) => {
    res.setEncoding('utf8');
    res.on('data', (d) => {
      resolve({
        status: res.statusCode,
        ticket: parseTicket(d),
      });
    });
  });

  req.on('error', (e) => {
    reject(e);
  });
  // post the data
  req.write(postData);
  req.end();
});
