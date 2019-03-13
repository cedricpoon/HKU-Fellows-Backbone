const express = require('express');

const crawler = require('../moodle/crawler');
const { db } = require('../database/connect');
const { decrypt, hash } = require('../security/safe');
const { responseSuccess, handleError } = require('./helper');
const { tokenGatekeeper, moodleKeyValidator } = require('./auth');
const { moodleCoursePath } = require('../moodle/urls');

const router = express.Router();

const insertNativePost = async ({
  username, title, subtitle, hashtag, content, anonymous, code,
}) => {
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
        anonymous,
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
        hashtag.primary,
        hashtag.secondary,
        postId,
        code.toUpperCase(),
      ],
    });
    return topicId;
  } catch (e) {
    throw new Error('database-error');
  }
};

const resolveCoursePathFromCode = async (code, cookieString) => {
  const courses = await crawler.getCourses({ cookieString });
  if (courses) {
    for (let i = 0; i < courses.length; i += 1) {
      if (courses[i].id === code.toUpperCase()) {
        return courses[i].path;
      }
    }
  }
  throw new Error('moodle-not-enrolled');
};

router.route('/native/:code').post(async (req, res) => {
  const { code } = req.params;
  const {
    username, token,
    title, subtitle, hashtag: _hashtag,
    content, anonymous,
  } = req.body;

  try {
    const hashtag = _hashtag ? JSON.parse(decodeURI(_hashtag)) : null;
    // check username and token are matched
    await tokenGatekeeper({ userId: username, token });
    // compose post to native database
    const newTopicId = await insertNativePost({
      username, title, subtitle, hashtag, content, anonymous, code,
    });
    responseSuccess({ topicId: newTopicId }, res);
  } catch (err) {
    handleError(err, res);
  }
});

router.route('/moodle/:code').post(async (req, res) => {
  const { code } = req.params;
  const {
    username, token, moodleKey,
    title, content,
  } = req.body;

  try {
    // check username and token are matched
    await tokenGatekeeper({ userId: username, token });
    // check moodleKey is valid
    await moodleKeyValidator({ moodleKey });
    const cookieString = decrypt(moodleKey);

    // compose post to Moodle
    const coursePath = await resolveCoursePathFromCode(code, cookieString);
    const defaultForum = await crawler.getDefaultForum({ cookieString, coursePath });

    const mcId = coursePath.replace(moodleCoursePath, '');
    const moodleConfig = await crawler.getForumConfigKeypair({
      cookieString,
      forumPath: defaultForum.path,
    });

    const newPost = await crawler.composePost({
      cookieString,
      mCourseId: mcId,
      mForumId: moodleConfig.id,
      moodleConfig,
      title,
      content,
    });
    responseSuccess(newPost ? { topicId: newPost.id } : null, res, newPost ? 200 : 204);
  } catch (err) {
    handleError(err, res);
  }
});

module.exports = router;
