const { https, http } = require('follow-redirects');
const querystring = require('querystring');
const cheerio = require('cheerio');
const { showdown } = require('./markdown');

const { delay } = require('./config');

const {
  portalDomain,
  moodleDomain,
  servletLoginPath,
  moodleLoginPath,
  moodleForumPostPath,
  moodleForumPostPathMode1,
  moodleComposePath,
  moodleComposeForumIdPath,
} = require('./urls');

const {
  parseTicket,
  extractDomainCookies,
  lookupLoginPattern,
  extractSlug,
  standardizePost,
} = require('./helper');

const visitMoodle = ({
  cookieString,
  path,
  postData: _postData,
}) => new Promise((resolve, reject) => {
  const postData = _postData != null ? querystring.stringify(_postData) : null;
  const postHeader = postData != null ? {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData),
  } : {};

  const options = {
    hostname: moodleDomain,
    port: 80,
    method: postData != null ? 'POST' : 'GET',
    path: path || '/',
    headers: {
      Cookie: cookieString,
      ...postHeader,
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
  if (postData != null) {
    // post the data
    req.write(postData);
  }
  req.end();
});

const composePost = ({
  cookieString,
  mCourseId,
  mForumId,
  title,
  content,
  moodleConfig,
}) => new Promise((resolve, reject) => {
  const postData = {
    course: mCourseId,
    forum: mForumId,
    sesskey: moodleConfig.sesskey,
    _qf__mod_forum_post_form: 1,
    mform_isexpanded_id_general: 1,
    subject: title,
    'message[text]': showdown.makeHtml(content),
    'message[format]': 1,
    'message[itemid]': moodleConfig.itemid,
    discussionsubscribe: 1,
    attachments: moodleConfig.attachments,
    submitbutton: 'Post to forum',
  };

  visitMoodle({ cookieString, path: moodleComposePath, postData })
    .then((moodle_hku_hk_mod_forum_view) => {
      if (moodle_hku_hk_mod_forum_view.includes('Your post was successfully added.')
        || moodle_hku_hk_mod_forum_view.includes('This post will be mailed out immediately to all forum subscribers.')
      ) {
        const $ = cheerio.load(moodle_hku_hk_mod_forum_view, { decodeEntities: false });
        let newPost = null;

        $('table.forumheaderlist tbody tr').each((i, post) => {
          const postTitle = $(post).children('.topic').children('a').html();
          if (postTitle === title) {
            newPost = {
              id: $(post).children('.topic').children('a').attr('href')
                .replace(`http://${moodleDomain}${moodleForumPostPath}`, 'mod'),
              native: false,
              timestamp: $(post).children('.lastpost').children('a[href*="discuss.php"]').html(),
              replyNo: Number($(post).children('.replies').children('a').html()),
              title,
              subtitle: $('div[role="main"] > h2').html(),
            };
          }
        });

        resolve(newPost);
      }
      reject(new Error('moodle-post-not-created'));
    })
    .catch((e) => {
      reject(e);
    });
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
          content: standardizePost($(post).find('.content > .posting').html()),
        });
      });

      resolve({
        title: $('.discussionname').html(),
        subtitle: $('div[role="main"] > h2').html(),
        posts,
      });
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

const getForums = ({ cookieString, coursePath, generalOnly }) => new Promise((resolve, reject) => {
  visitMoodle({ cookieString, path: coursePath })
    .then((moodle_hku_hk_course) => {
      const forums = [];
      const $ = cheerio.load(moodle_hku_hk_course, { decodeEntities: false });

      $('a[href*="/mod/forum/view.php?id="]').each((i, elem) => {
        const forum = {
          description: $($(elem).children('span')).html().replace(/<span.+<\/span>/, ''),
          path: $(elem).attr('href').replace('http://moodle.hku.hk', ''),
        };

        if (generalOnly && forum.description.toLowerCase().match(/(general|default)/g)) {
          resolve(forum);
        }
        forums.push(forum);
      });

      if (generalOnly) reject(new Error('moodle-no-default-forum'));

      setTimeout(() => {
        resolve(forums);
      }, delay);
    })
    .catch((e) => {
      reject(e);
    });
});

const getForumConfigKeypair = ({ cookieString, forumPath }) => new Promise((resolve, reject) => {
  visitMoodle({ cookieString, path: forumPath })
    .then((moodle_hku_hk_mod_forum) => {
      const $ = cheerio.load(moodle_hku_hk_mod_forum, { decodeEntities: false });
      const mfId = $('input[name="forum"]').attr('value');

      visitMoodle({ cookieString, path: `http://${moodleDomain}${moodleComposeForumIdPath}${mfId}` })
        .then((moodle_hku_hk_mod_forum_post) => {
          const $$ = cheerio.load(moodle_hku_hk_mod_forum_post, { decodeEntities: false });

          resolve({
            id: mfId,
            sesskey: $$('input[name="sesskey"]').attr('value'),
            itemid: $$('input[name="message[itemid]"]').attr('value'),
            attachments: $$('input[name="message[attachments]"]').attr('value'),
          });
        });
    })
    .catch((e) => {
      reject(e);
    });
});

const getDefaultForum = ({ cookieString, coursePath }) => getForums({
  cookieString,
  coursePath,
  generalOnly: true,
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
  getDefaultForum,
  getForumConfigKeypair,
  retrievePostsFromCourse,
  visitPost,
  composePost,
};
