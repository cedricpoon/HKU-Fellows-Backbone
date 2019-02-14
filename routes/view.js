const express = require('express');

const crawler = require('../moodle/crawler');
const { db } = require('../database/connect');
const { decrypt } = require('../security/safe');
const { responseError, responseSuccess } = require('./helper');
const { tokenGatekeeper } = require('./auth');

const router = express.Router();

const getNativeReply = async (topicId) => {
  try {
    // get native post from database
    const topic = await db.query({
      sql: `select P.*
              from Topic T
              join Post as P on T.PostId = P.PostId
              where T.TopicId = ?`,
      values: [topicId],
    });
    const resTopic = topic[0];
    const resultPosts = [{
      id: resTopic.PostId,
      timestamp: resTopic.Timestamp,
      temperature: resTopic.Temperature,
      content: resTopic.Content,
    }];
    if (!resTopic.Anonymous) resultPosts[0].author = resTopic.Author;
    // get native replies
    const reply = await db.query({
      sql: `select P.*
              from Topic T
              left join Reply as R on T.TopicId = R.TopicId
              join Post as P on R.PostId = P.PostId
              where T.TopicId = ?
              order by P.Timestamp asc`,
      values: [topicId],
    });
    for (let i = 0; i < reply.length; i += 1) {
      const dbobj = reply[i];
      const resultobj = {
        id: dbobj.PostId,
        timestamp: dbobj.Timestamp,
        temperature: dbobj.Temperature,
        content: dbobj.Content,
      };
      if (!dbobj.Anonymous) resultobj.author = dbobj.Author;
      resultPosts.push(resultobj);
    }
    return resultPosts;
  } catch (e) {
    throw new Error('database-error');
  }
};

router.route('/:topicId').post(async (req, res) => {
  const { topicId } = req.params;
  const { username, token, moodleKey } = req.body;

  try {
    // check username and token are matched
    await tokenGatekeeper({ userId: username, token });
    // check moodleKey is valid
    const cookieString = decrypt(moodleKey);
    const isLoggedIn = await crawler.proveLogin({
      cookieString,
    });
    if (isLoggedIn) {
      const result = await getNativeReply(topicId);
      responseSuccess(result, res);
    } else {
      responseError(408, res);
    }
  } catch (err) {
    switch (err.message) {
      case 'database-error':
        responseError(502, res);
        break;
      case 'crawling-error':
        responseError(421, res);
        break;
      case 'login-error':
        responseError(401, res);
        break;
      default:
        responseError(500, res);
    }
  }
});

module.exports = router;
