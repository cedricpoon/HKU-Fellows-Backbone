const express = require('express');

const crawler = require('../moodle/crawler');
const { db } = require('../database/connect');
const { decrypt, hash } = require('../security/safe');
const {
  responseSuccess, responseError, handleError, resolveCoursePathFromCode,
} = require('./helper');
const { tokenGatekeeper, moodleKeyValidator } = require('./auth');
const { moodleDomain, moodleCoursePath, moodleReplyPath } = require('../moodle/urls');
const { broadcast } = require('../notification');

const router = express.Router();

const insertNativeReply = async (topicId, username, content, anonymous) => {
  const currentTime = Date.now();
  const postId = hash(`Post${username}${currentTime}`);
  const replyId = hash(`Reply${username}${currentTime}`);

  try {
    await db.query({
      sql: `insert into Post (PostId, Content, Author, Anonymous)
            values (?, ?, ?, ?)`,
      values: [
        postId,
        content,
        username,
        anonymous,
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

router.route('/native/:topicId').post(async (req, res) => {
  const { topicId } = req.params;
  const {
    username, token,
    content, anonymous,
  } = req.body;

  try {
    // check username and token are matched
    await tokenGatekeeper({ userId: username, token });

    if (anonymous === '0' || anonymous === '1') {
      // get content of native post
      const result = await insertNativeReply(topicId, username, content, anonymous);
      // push notify all subscribed users
      await broadcast({ topicId, replierId: username });
      responseSuccess(result, res);
    } else {
      responseError(422, res);
    }
  } catch (err) {
    handleError(err, res);
  }
});

router.route('/moodle/:topicId').post(async (req, res) => {
  const { topicId } = req.params;
  const {
    username, token, moodleKey,
    code, content,
  } = req.body;

  try {
    // check username and token are matched
    await tokenGatekeeper({ userId: username, token });
    // check moodleKey is valid
    await moodleKeyValidator({ moodleKey });
    const cookieString = decrypt(moodleKey);

    const coursePath = await resolveCoursePathFromCode(code, cookieString);
    const post = await crawler.visitPost({ cookieString, postId: topicId });

    const mCourseId = coursePath.replace(moodleCoursePath, '');
    const mDiscussionId = topicId.replace('mod', '');
    const parentId = post.posts[0].id.replace('p', '');
    const moodleConfig = await crawler.getReplyConfigKeypair({
      cookieString,
      replyPath: `http://${moodleDomain}${moodleReplyPath}${parentId}`,
    });

    // reply moodle post
    const newReply = await crawler.replyPost({
      cookieString,
      mCourseId,
      mDiscussionId,
      parentId,
      moodleConfig,
      title: post.title,
      content,
    });
    responseSuccess({ postId: newReply.id }, res);
  } catch (err) {
    handleError(err, res);
  }
});

module.exports = router;
