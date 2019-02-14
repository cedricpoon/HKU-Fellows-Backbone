const { https, http } = require('follow-redirects');
const querystring = require('querystring');
const cheerio = require('cheerio');

const { delay } = require('./config');

const {
  portalDomain,
  moodleDomain,
  servletLoginPath,
  moodleLoginPath,
  moodleForumPostPath,
  moodleForumPostPathMode1,
} = require('./urls');

const {
  parseTicket,
  extractDomainCookies,
  lookupLoginPattern,
  extractSlug,
} = require('./helper');

const visitMoodle = ({ cookieString, path }) => new Promise((resolve, reject) => {
  const options = {
    hostname: moodleDomain,
    port: 80,
    method: 'GET',
    path: path || '/',
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

const visitPost = ({ cookieString, postId }) => new Promise((resolve, reject) => {
  const postPath = postId.replace('mod', `http://${moodleDomain}${moodleForumPostPathMode1}`);

  visitMoodle({ cookieString, path: postPath })
    .then((moodle_hku_hk_mod_forum_discuss) => {
      const $ = cheerio.load(moodle_hku_hk_mod_forum_discuss, { decodeEntities: false });
      const posts = [];

      if ($('.forumpost').length === 0) reject(new Error('moodle-not-enrolled'));

      $('.forumpost').each((i, post) => {
        posts.push({
          id: $(post).prev().attr('id'),
          author: $(post).find('.author a').html(),
          timestamp: $(post).find('.author').html().replace(/^by\s.+\s-\s/, ''),
          content: $(post).find('.content > .posting').html(),
        });
      });

      resolve(posts);
    })
    .catch((e) => {
      reject(e);
    });
});

const getCourses = ({ cookieString }) => new Promise((resolve, reject) => {
  visitMoodle({ cookieString })
    .then((moodle_hku_hk) => {
      const courses = [];
      const $ = cheerio.load(moodle_hku_hk, { decodeEntities: false });

      $('.type_course a[href][title]').each((i, elem) => {
        courses.push({
          id: extractSlug($(elem).html()),
          title: $(elem).attr('title'),
          path: $(elem).attr('href').replace(`http://${moodleDomain}`, ''),
        });
      });

      resolve(courses);
    })
    .catch((e) => {
      reject(e);
    });
});

const getPosts = ({ cookieString, forumPath }) => new Promise((resolve, reject) => {
  visitMoodle({ cookieString, path: forumPath })
    .then((moodle_hku_hk_mod_forum) => {
      const $ = cheerio.load(moodle_hku_hk_mod_forum, { decodeEntities: false });
      const posts = [];

      $('table.forumheaderlist tbody tr').each((i, post) => {
        posts.push({
          id: $(post).children('.topic').children('a').attr('href')
            .replace(`http://${moodleDomain}${moodleForumPostPath}`, 'mod'),
          native: false,
          timestamp: $(post).children('.lastpost').children('a[href*="discuss.php"]').html(),
          replyNo: Number($(post).children('.replies').children('a').html()),
          title: $(post).children('.topic').children('a').html(),
          subtitle: $('div[role="main"] > h2').html(),
        });
      });

      setTimeout(() => {
        resolve(posts);
      }, delay);
    })
    .catch((e) => {
      reject(e);
    });
});

const getForums = ({ cookieString, coursePath }) => new Promise((resolve, reject) => {
  visitMoodle({ cookieString, path: coursePath })
    .then((moodle_hku_hk_course) => {
      const forums = [];
      const $ = cheerio.load(moodle_hku_hk_course, { decodeEntities: false });

      $('a[href*="/mod/forum/view.php?id="]').each((i, elem) => {
        forums.push({
          description: $($(elem).children('span')).html().replace(/<span.+<\/span>/, ''),
          path: $(elem).attr('href').replace('http://moodle.hku.hk', ''),
        });
      });

      setTimeout(() => {
        resolve(forums);
      }, delay);
    })
    .catch((e) => {
      reject(e);
    });
});

const retrievePostsFromCourse = async ({ cookieString, coursePath }) => {
  const getPostsWrapper = async ({ cs, forumPath }) => getPosts({ cookieString: cs, forumPath });

  try {
    // get all forums associated with course
    const forums = await getForums({ cookieString, coursePath });

    const results = [];
    for (let i = 0; i < forums.length; i += 1) {
      // get all posts from forums
      results.push(getPostsWrapper({ cs: cookieString, forumPath: forums[i].path }));
    }
    const posts = await Promise.all(results);

    // return all posts associated with course
    return [].concat(...posts);
  } catch (e) {
    throw new Error('crawling-error');
  }
};

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
          if (moodleCookies === '') {
            reject(new Error('loginMoodle-err1'));
          }
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
  getCourses,
  retrievePostsFromCourse,
  visitPost,
};
