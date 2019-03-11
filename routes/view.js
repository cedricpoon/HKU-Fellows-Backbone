const express = require('express');

const crawler = require('../moodle/crawler');
const { db } = require('../database/connect');
const { decrypt, hash } = require('../security/safe');
const { responseError, responseSuccess } = require('./helper');
const { tokenGatekeeper, moodleKeyValidator } = require('./auth');

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
    console.log(e);
    if (e.message === 'inaccessible') {
      throw e;
    }
    throw new Error('database-error');
  }
};

const insertNativeReply = async (topicId, username, content, anonymous) => {
  const currentTime = Date.now();
  const postId = hash(username + currentTime);
  const replyId = hash(`Reply${username}${currentTime}`);

  try {
    await db.query({
      sql: `insert into Post (PostId, Content, Author, Anonymous)
            values (?, ?, ?, ?)`,
      values: [
        postId,
        content,
        username,
        anonymous === '1' ? 1 : 0,
      ],
    });
    await db.query({
      sql: 'insert into Reply values (?, ?, ?)',
      values: [
        replyId,
        postId,
        topicId,
      ],
    });
    return { postId };
  } catch (e) {
    throw new Error('database-error');
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
    switch (err.message) {
      case 'inaccessible':
        responseError(403, res);
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
});

router.route('/:topicId/reply').post(async (req, res) => {
  const { topicId } = req.params;
  const {
    username, token, moodleKey,
    content, anonymous,
  } = req.body;

  try {
    // check username and token are matched
    await tokenGatekeeper({ userId: username, token });

    if (topicId.startsWith('mod')) {
      // check moodleKey is valid
      await moodleKeyValidator({ moodleKey });
      const cookieString = decrypt(moodleKey);

      // reply moodle post
      // const result = await crawler.visitPost({ cookieString, postId: topicId });
      // responseSuccess(result, res);
    } else if (anonymous === '0' || anonymous === '1') {
      // get content of native post
      const result = await insertNativeReply(topicId, username, content, anonymous);
      responseSuccess(result, res);
    } else {
      responseError(422, res);
    }
  } catch (err) {
    console.log(err);
    switch (err.message) {
      case 'moodle-not-enrolled':
        responseError(412, res);
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
      responseSuccess(result, res);
    }
  } catch (err) {
    console.log(err);
    switch (err.message) {
      case 'moodle-not-enrolled':
        responseError(412, res);
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
