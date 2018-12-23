const express = require('express');

const crawler = require('../moodle/crawler');
const db = require('../database/connect');
const { encrypt, hash } = require('../auth/safe');

const router = express.Router();

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
  const { username, password } = req.body;

  if (username && password) {
    // crawling login
    crawler.login({ username, password })
      .then(async ({ cookieString }) => {
        try {
          // check if db contains user
          const result = await db.query({
            sql: 'select Token from User where UserId = ?',
            values: [username],
          });
          let token = result.length === 0 ? '' : result[0].Token;
          if (result.length === 0) {
            // create new user
            token = hash(username);
            await db.query(
              'insert into User set ?',
              { UserId: username, Token: token },
            );
          }
          res.json({
            status: 200,
            payload: {
              authCookie: cookieString,
              passphrase: encrypt(password),
              token,
            },
          });
        } catch (err) {
          res.json({
            status: 502,
            error: 'Database connection failure',
          });
        }
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
