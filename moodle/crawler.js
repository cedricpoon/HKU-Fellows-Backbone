const { https, http } = require('follow-redirects');

const querystring = require('querystring');

const {
  portalDomain,
  moodleDomain,
  servletLoginPath,
  moodleLoginPath,
} = require('./urls');

const { parseTicket, extractDomainCookies, lookupLoginPattern } = require('./helper');

const visitMoodle = ({ cookieString }) => new Promise((resolve, reject) => {
  const options = {
    hostname: moodleDomain,
    port: 80,
    method: 'GET',
    headers: {
      Cookie: cookieString,
    },
  };
  const req = http.request(options, (res) => {
    let chunks = '';

    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      chunks += chunk;
    });

    res.on('end', () => {
      resolve(chunks);
    });
  });

  req.on('error', (e) => {
    reject(e);
  });

  req.end();
});

const proveLogin = ({ cookieString }) => new Promise((resolve, reject) => {
  visitMoodle({ cookieString })
    .then((context) => {
      resolve(lookupLoginPattern(context));
    })
    .catch((e) => {
      reject(e);
    });
});

const loginMoodle = ({ queryString, cookieString }) => new Promise((resolve, reject) => {
  const options = {
    hostname: moodleDomain,
    port: 443,
    path: `${moodleLoginPath}${queryString}`,
    method: 'GET',
    referer: `https://${portalDomain}${servletLoginPath}`,
    headers: {
      Cookie: cookieString,
    },
  };
  options.trackRedirects = true;

  const req = https.request(options, (res) => {
    res.setEncoding('utf8');
    res.on('data', () => {
      res.redirects.forEach((redirect, i) => {
        if (redirect.url === `https://${moodleDomain}:443${moodleLoginPath}${queryString}`) {
          const moodleCookies = extractDomainCookies({
            cookies: redirect.headers['set-cookie'],
          });

          resolve({ cookieString: moodleCookies });
        } else if (i === res.redirects.length - 1) {
          reject(new Error('loginMoodle-err1'));
        }
      });
      if (!res.redirects) {
        reject(new Error('loginMoodle-err2'));
      }
    });
  });

  req.on('error', (e) => {
    reject(e);
  });

  req.end();
});

const loginMoodleWithTicket = ({ ticket, cookieString }) => new Promise((resolve, reject) => {
  loginMoodle({
    queryString: `&ticket=${ticket}`,
    cookieString,
  })
    .then((payload) => {
      resolve({ cookieString: payload.cookieString });
    })
    .catch((e) => {
      reject(e);
    });
});

const login = ({ username, password }) => new Promise((resolve, reject) => {
  const postData = querystring.stringify({
    service: `https://${moodleDomain}${moodleLoginPath}`,
    username,
    password,
  });
  const options = {
    hostname: portalDomain,
    port: 443,
    path: servletLoginPath,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
  };
  let portalCookies;
  let ticket;

  // first level login to https://hkuportal.hku.hk/cas/servlet/edu.yale.its.tp.cas.servlet.Login
  const req = https.request(options, (res) => {
    res.setEncoding('utf8');
    res.on('data', (d) => {
      // successfully authenticated with username password
      if (res.statusCode === 200) {
        portalCookies = extractDomainCookies({
          cookies: res.headers['set-cookie'],
          domain: '.hku.hk',
        });
        ticket = parseTicket(d);
      } else {
        reject(new Error('unauthenticated'));
      }
    });
    res.on('end', () => {
      // second level login to https://moodle.hku.hk/login/index.php?authCAS=CAS&ticket=******
      loginMoodleWithTicket({
        ticket,
        cookieString: portalCookies,
      })
        .then(({ cookieString }) => {
          // third level login to https://moodle.hku.hk/login/index.php?authCAS=CAS
          loginMoodle({
            queryString: '',
            cookieString: portalCookies.concat(cookieString),
          })
            .then((thirdLevel) => {
              resolve({
                cookieString: portalCookies.concat(thirdLevel.cookieString),
              });
            })
            .catch((e) => {
              reject(e);
            });
        }).catch((e) => {
          reject(e);
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

module.exports = {
  login,
  visitMoodle,
  proveLogin,
};
