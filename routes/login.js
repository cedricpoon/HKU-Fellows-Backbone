const express = require('express');

const router = express.Router();

const crawler = require('../auth/crawler');

router.route('/validate').post((req, res) => {
  if (req.body.authCookie) {
    crawler.visitMoodle({
      cookieString: req.body.authCookie,
    })
      .then((isLoggedIn) => {
        res.json({
          status: 200,
          payload: {
            isValid: isLoggedIn,
          },
        });
      })
      .catch(() => {
        res.json({
          status: 500,
          error: 'crawling error',
        });
      });
  } else {
    res.json({
      status: 422,
      error: 'malformed request',
    });
  }
});

router.route('/').post((req, res) => {
  if (req.body.username && req.body.password) {
    crawler.login({
      username: req.body.username,
      password: req.body.password,
    })
      .then(({ cookieString }) => {
        res.json({
          status: 200,
          payload: {
            authCookie: cookieString,
          },
        });
      })
      .catch((error) => {
        switch (error.message) {
          case 'unauthenticated':
            res.json({
              status: 401,
              error: error.message,
            });
            break;
          case 'loginMoodle-err1':
            res.json({
              status: 421,
              error: 'crawling error',
            });
            break;
          case 'loginMoodle-err2':
            res.json({
              status: 400,
              error: 'crawling error',
            });
            break;
          default:
            res.json({
              status: 500,
              error: 'crawling error',
            });
        }
      });
  } else {
    res.json({
      status: 422,
      error: 'malformed request',
    });
  }
});

module.exports = router;
