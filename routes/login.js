const express = require('express');

const crawler = require('../moodle/crawler');
const db = require('../database/connect');
const { decrypt, encrypt, hash } = require('../auth/safe');
const { responseError, responseSuccess } = require('./helper.js');

const router = express.Router();

const loginCallback = ({ username, password, response }) => {
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
            token = hash(`${username};${new Date()}`);
            await db.query(
              'insert into User set ?',
              { UserId: username, Token: token },
            );
          }
          responseSuccess({
            moodleKey: encrypt(cookieString),
            passphrase: encrypt(password),
            token,
          }, response);
        } catch (err) {
          responseError(502, response);
        }
      })
      .catch((error) => {
        switch (error.message) {
          case 'unauthenticated':
            responseError(401, response);
            break;
          case 'loginMoodle-err1':
            responseError(421, response);
            break;
          case 'loginMoodle-err2':
            responseError(400, response);
            break;
          default:
            responseError(500, response);
        }
      });
  } else {
    responseError(422, response);
  }
};

router.route('/validate').post((req, res) => {
  if (req.body.moodleKey) {
    crawler.proveLogin({
      cookieString: decrypt(req.body.moodleKey),
    })
      .then((isLoggedIn) => {
        responseSuccess({
          isValid: isLoggedIn,
        }, res);
      })
      .catch(() => {
        responseError(500, res);
      });
  } else {
    responseError(422, res);
  }
});

router.route('/passphrase').post((req, res) => {
  const { username, passphrase } = req.body;
  const password = decrypt(passphrase);
  // actual login with decrypting passphrase
  loginCallback({
    username,
    // 1 char for returning unauthenticated
    password: password === '' ? ' ' : password,
    response: res,
  });
});

router.route('/password').post((req, res) => {
  const { username, password } = req.body;
  // actual login with password
  loginCallback({
    username,
    password,
    response: res,
  });
});

module.exports = router;
