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

// router.route('/post/:code/:index').post((req, res) => {
//   if (req.body.moodleKey) {
//     crawler.proveLogin({
//       cookieString: decrypt(req.body.moodleKey),
//     })
//       .then((isLoggedIn) => {
//         responseSuccess({
//           isValid: isLoggedIn,
//         }, res);
//       })
//       .catch(() => {
//         responseError(500, res);
//       });
//   } else {
//     responseError(422, res);
//   }
// });

router.route('/post/:code/:index').post(async (req, res) => {
  // start from 1
  const { code, index } = req.params;
  try {
    console.log(code);
    const result = await db.query(
      `select * from Post
      where CourseId='${code.toUpperCase()}'
      LIMIT ${(parseInt(index, 10) - 1) * 20}, 20`,
    );
    responseSuccess(result, res, result.length === 0 ? 204 : 200);
  } catch (err) {
    responseError(502, res);
  }
});

module.exports = router;
