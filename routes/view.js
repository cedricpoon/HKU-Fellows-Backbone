const express = require('express');

const crawler = require('../moodle/crawler');
const { db } = require('../database/connect');
const { decrypt } = require('../security/safe');
const { responseSuccess, handleError, responseError } = require('./helper');
const { tokenGatekeeper, moodleKeyValidator } = require('./auth');
const { isSubscribed } = require('../notification');

const router = express.Router();

const getNativeReply = async (topicId, username) => {
  try {
    // get native post from database
    const topic = await db.query({
      sql: `select *
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
    return {
      title: resTopic.Title,
      subtitle: resTopic.Subtitle,
      native: 1,
      solved: resTopic.Solved,
      owned: username === resTopic.Author ? 1 : 0,
      posts: resultPosts,
    };
  } catch (e) {
    throw new Error('database-error');
  }
};

const adoptAnswer = async (topicId, postId, username) => {
  try {
    const topic = await db.query({
      sql: `select Author, Solved
              from Topic T
              join Post as P on T.PostId = P.PostId
              where T.TopicId = ?`,
      values: [topicId],
    });
    const reply = await db.query({
      sql: `select * from Reply
              where PostId = ? and TopicId = ?`,
      values: [postId, topicId],
    });
    // topic have been solved
    if (topic[0].Solved !== null) throw new Error('inaccessible');
    // user is not the author of post
    if (topic[0].Author !== username) throw new Error('inaccessible');
    // reply not belong to topic
    if (reply.length === 0) throw new Error('inaccessible');

    await db.query({
      sql: `update Topic set Solved = ?
              where TopicId = ?`,
      values: [postId, topicId],
    });
  } catch (e) {
    if (e.message === 'inaccessible') {
      throw e;
    }
    throw new Error('database-error');
  }
};

const registerTopic = async (req, res, { sql, values }) => {
  const { topicId } = req.params;
  const { username, token } = req.body;

  try {
    // check username and token are matched
    await tokenGatekeeper({ userId: username, token });

    if (topicId.startsWith('mod')) {
      responseError(501, res);
    } else {
      await db.query({ sql, values });
      responseSuccess({}, res);
    }
  } catch (e) {
    handleError(e, res);
  }
};

router.route('/:topicId/adopt').post(async (req, res) => {
  const { topicId } = req.params;
  const { username, token, postId } = req.body;

  try {
    // check username and token are matched
    await tokenGatekeeper({ userId: username, token });

    await adoptAnswer(topicId, postId, username);
    responseSuccess({}, res);
  } catch (err) {
    handleError(err, res);
  }
});

router.route('/:topicId/subscribe').post(async (req, res) => {
  const { topicId } = req.params;
  const { username } = req.body;

  await registerTopic(req, res, {
    sql: 'insert into TopicRegistry set ?',
    values: [{ TopicId: topicId, UserId: username }],
  });
});

router.route('/:topicId/unsubscribe').post(async (req, res) => {
  const { topicId } = req.params;
  const { username } = req.body;

  await registerTopic(req, res, {
    sql: 'delete from TopicRegistry where TopicId = ? and UserId = ?',
    values: [topicId, username],
  });
});

router.route('/:topicId').post(async (req, res) => {
  const { topicId } = req.params;
  const { username, token, moodleKey } = req.body;

  try {
    // check username and token are matched
    await tokenGatekeeper({ userId: username, token });
    // check moodleKey is valid
    await moodleKeyValidator({ moodleKey });

    const cookieString = decrypt(moodleKey);
    if (topicId.startsWith('mod')) {
      // get content of moodle post
      const result = await crawler.visitPost({ cookieString, postId: topicId });
      responseSuccess(result, res);
    } else {
      // get content of native post
      const result = await getNativeReply(topicId, username);
      // get subscribed status
      const subscribed = await isSubscribed({ userId: username, topicId });
      responseSuccess({ ...result, subscribed }, res);
    }
  } catch (err) {
    handleError(err, res);
  }
});

module.exports = router;
