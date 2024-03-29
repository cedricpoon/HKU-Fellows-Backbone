const express = require('express');

const crawler = require('../moodle/crawler');
const { db } = require('../database/connect');
const { decrypt, encrypt, hash } = require('../security/safe');
const { responseError, responseSuccess, handleError } = require('./helper');
const { register, rescind } = require('../notification');

const router = express.Router();

const loginCallback = async ({ username, password, response }) => {
  if (username && password) {
    // crawling login
    try {
      const { cookieString } = await crawler.login({ username, password });
      try {
        const token = hash(`${username};${new Date()}`);
        await db.query({
          sql: `insert into User set ?
                  on duplicate key update Token = ?`,
          values: [{ UserId: username, Token: token }, token],
        });
        return {
          moodleKey: encrypt(cookieString),
          passphrase: encrypt(password),
          token,
        };
      } catch (err) {
        responseError(502, response);
      }
    } catch (error) {
      handleError(error, response);
    }
  } else {
    responseError(422, response);
  }
  return null;
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

router.route('/passphrase').post(async (req, res) => {
  const { username, passphrase } = req.body;
  const password = decrypt(passphrase);
  // actual login with decrypting passphrase
  const credential = await loginCallback({
    username,
    // 1 char for returning unauthenticated
    password: password === '' ? ' ' : password,
    response: res,
  });
  if (credential) responseSuccess(credential, res);
});

router.route('/password').post(async (req, res) => {
  const { username, password, fcmToken } = req.body;
  // actual login with password
  const credential = await loginCallback({
    username,
    password,
    response: res,
  });
  try {
    if (credential) {
      await rescind({ userId: username });
      if (fcmToken) {
        // register for device in order to receive push notification
        register({ fcmToken, userId: username, token: credential.token });
      }
      responseSuccess(credential, res);
    }
  } catch (e) {
    handleError(e, res);
  }
});

module.exports = router;
