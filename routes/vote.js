const express = require('express');

const { db } = require('../database/connect');
const { responseError, responseSuccess } = require('./helper');
const { tokenGatekeeper } = require('./auth');

const router = express.Router();

const ratePost = async (postId, userId, rate) => {
  try {
    const isOwned = await db.query({
      sql: `select count(*) as Owned
              FROM Post
              WHERE Author = ? and PostId = ?`,
      values: [userId, postId],
    });
    // User cannot vote their own post
    if (isOwned[0].Owned === 1) throw new Error('err1');

    await db.query({
      sql: `insert into Rating (UserId, PostId, Liked)
            values (?, ?, ?)`,
      values: [userId, postId, rate],
    });
    await db.query({
      sql: `update Post set Temperature = Temperature + ?
            where PostId = ?`,
      values: [rate, postId],
    });
  } catch (e) {
    // entry of same userId and postId existed
    if (e.errno === 1062) {
      throw new Error('entry-exist-error');
    }
    if (e.message === 'err1') {
      throw new Error('self-voting-error');
    }
    throw new Error('database-error');
  }
};

const voteRouter = value => async (req, res) => {
  const { postId } = req.params;
  const { username, token } = req.body;

  try {
    // check username and token are matched
    await tokenGatekeeper({ userId: username, token });

    await ratePost(postId, username, value);
    responseSuccess({}, res);
  } catch (err) {
    switch (err.message) {
      case 'entry-exist-error':
        responseError(409, res);
        break;
      case 'self-voting-error':
        responseError(410, res);
        break;
      case 'database-error':
        responseError(502, res);
        break;
      case 'login-error':
        responseError(401, res);
        break;
      default:
        responseError(500, res);
    }
  }
};

router.route('/:postId/up').post(voteRouter(1));

router.route('/:postId/down').post(voteRouter(-1));

module.exports = router;
