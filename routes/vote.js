const express = require('express');

const { db } = require('../database/connect');
const { responseError, responseSuccess } = require('./helper');
const { tokenGatekeeper, moodleKeyValidator } = require('./auth');

const router = express.Router();

const ratePost = async (postId, userId, rate) => {
  try {
    await db.query({
      sql: `insert into Rating (UserId, PostId, Liked)
            values (?, ?, ?)`,
      values: [userId, postId, rate],
    });
    if (rate === 1) { // like the post
      await db.query({
        sql: `update Post set Temperature = Temperature + 1
              where PostId = ?`,
        values: [postId],
      });
    } else { // dislike the post
      await db.query({
        sql: `update Post set Temperature = Temperature - 1
              where PostId = ?`,
        values: [postId],
      });
    }
  } catch (e) {
    // entry of same userId and postId existed
    if (e.errno === 1062) {
      throw new Error('entry-exist-error');
    }
    throw new Error('database-error');
  }
};

router.route('/:postId/like').post(async (req, res) => {
  const { postId } = req.params;
  const {
    username, token, moodleKey,
  } = req.body;

  try {
    // check username and token are matched
    await tokenGatekeeper({ userId: username, token });
    // check moodleKey is valid
    await moodleKeyValidator({ moodleKey });

    const result = await ratePost(postId, username, 1);
    responseSuccess(result, res);
  } catch (err) {
    switch (err.message) {
      case 'entry-exist-error':
        responseError(409, res);
        break;
      case 'database-error':
        responseError(502, res);
        break;
      case 'login-error':
        responseError(401, res);
        break;
      case 'moodle-key-timeout':
        responseError(408, res);
        break;
      default:
        responseError(500, res);
    }
  }
});

router.route('/:postId/dislike').post(async (req, res) => {
  const { postId } = req.params;
  const {
    username, token, moodleKey,
  } = req.body;

  try {
    // check username and token are matched
    await tokenGatekeeper({ userId: username, token });
    // check moodleKey is valid
    await moodleKeyValidator({ moodleKey });

    const result = await ratePost(postId, username, 0);
    responseSuccess(result, res);
  } catch (err) {
    switch (err.message) {
      case 'entry-exist-error':
        responseError(409, res);
        break;
      case 'database-error':
        responseError(502, res);
        break;
      case 'login-error':
        responseError(401, res);
        break;
      case 'moodle-key-timeout':
        responseError(408, res);
        break;
      default:
        responseError(500, res);
    }
  }
});

module.exports = router;
