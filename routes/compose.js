const express = require('express');

const crawler = require('../moodle/crawler');
const { db } = require('../database/connect');
const { decrypt, hash } = require('../security/safe');
const { responseError, responseSuccess } = require('./helper');
const { tokenGatekeeper } = require('./auth');

const router = express.Router();

const insertNativePost = async (postData) => {
  const {
    username, title, subtitle, primaryHashtag, secondaryHashtag, content, anonymous, code,
  } = postData;
  const currentTime = Date.now();
  const topicId = hash(`Topic${title}${currentTime}`);
  const postId = hash(title + currentTime);

  try {
    if (parseInt(anonymous, 10) !== 1 && parseInt(anonymous, 10) !== 0) {
      throw new Error('parameter-error');
    }
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
      sql: `insert into Topic (TopicId, Title, Subtitle,
              PrimaryHashtag, SecondaryHashtag, PostId, CourseId)
            values (?, ?, ?, ?, ?, ?, ?)`,
      values: [
        topicId,
        title,
        subtitle,
        primaryHashtag || null,
        secondaryHashtag || null,
        postId,
        code.toUpperCase(),
      ],
    });
    return {
      topicId, title, subtitle, native: true,
    };
  } catch (e) {
    if (e.message === 'parameter-error') {
      throw new Error(e.message);
    }
    throw new Error('database-error');
  }
};

router.route('/:code').post(async (req, res) => {
  const { code } = req.params;
  const {
    username, token, moodleKey,
    title, subtitle, primaryHashtag,
    secondaryHashtag, content, anonymous,
  } = req.body;

  try {
    // check username and token are matched
    await tokenGatekeeper({ userId: username, token });
    // check moodleKey is valid
    const cookieString = decrypt(moodleKey);
    const isLoggedIn = await crawler.proveLogin({
      cookieString,
    });
    if (isLoggedIn) {
      const postData = {
        username, title, subtitle, primaryHashtag, secondaryHashtag, content, anonymous, code,
      };
      const result = await insertNativePost(postData);
      responseSuccess(result, res);
    } else {
      responseError(408, res);
    }
  } catch (err) {
    switch (err.message) {
      case 'parameter-error':
        responseError(422, res);
        break;
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