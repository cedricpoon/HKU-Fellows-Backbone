const express = require('express');

const { db } = require('../database/connect');
const { decrypt, hash } = require('../auth/safe');
const { responseError, responseSuccess } = require('./helper');
const { checkLogin } = require('./helper/login');

const router = express.Router();

const insertNativePost = async (postData) => {
  const {
    username, title, subtitle, primaryHashtag, secondaryHashtag, content, anonymous, code,
  } = postData;
  const currentTime = Date.now();
  const topicId = hash(`Topic${title}${currentTime}`);
  const postId = hash(title + currentTime);
  try {
    await db.query({
      sql: `insert into Post (PostId, Content, Author, Anonymous)
            values (?, ?, ?, ?)`,
      values: [
        postId,
        content,
        username,
        anonymous ? 1 : 0,
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
    const cookieString = decrypt(moodleKey);
    const login = await checkLogin(username, token, cookieString);
    if (login !== 200) {
      responseError(login, res);
    } else {
      const postData = {
        username, title, subtitle, primaryHashtag, secondaryHashtag, content, anonymous, code,
      };
      const result = await insertNativePost(postData);
      responseSuccess(result, res);
    }
  } catch (err) {
    switch (err.message) {
      case 'database-error':
        responseError(502, res);
        break;
      case 'crawling-error':
        responseError(421, res);
        break;
      default:
        responseError(500, res);
    }
  }
});

module.exports = router;
