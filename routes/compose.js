const express = require('express');

const crawler = require('../moodle/crawler');
const { db } = require('../database/connect');
const { decrypt, hash } = require('../security/safe');
const { responseError, responseSuccess } = require('./helper');
const { tokenGatekeeper, moodleKeyValidator } = require('./auth');
const { moodleCoursePath } = require('../moodle/urls');

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

router.route('/:code').post(async (req, res) => {
  const { code } = req.params;
  const {
    username, token, moodleKey,
    title, subtitle, primaryHashtag,
    secondaryHashtag, content, anonymous, native,
  } = req.body;

  try {
    if ((native === '1' && (anonymous === '0' || anonymous === '1')) || native === '0') {
      // check username and token are matched
      await tokenGatekeeper({ userId: username, token });
      // check moodleKey is valid
      await moodleKeyValidator({ moodleKey });

      const cookieString = decrypt(moodleKey);

      if (native === '1') {
        const postData = {
          username, title, subtitle, primaryHashtag, secondaryHashtag, content, anonymous, code,
        };
        const newPost = await insertNativePost(postData);
        responseSuccess({ topicId: newPost.topicId }, res);
      } else {
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

        responseSuccess({ topicId: newPost.id }, res, newPost ? 200 : 204);
      }
    } else {
      responseError(422, res);
    }
  } catch (err) {
    switch (err.message) {
      case 'database-error':
        responseError(502, res);
        break;
      case 'moodle-not-enrolled':
        responseError(412, res);
        break;
      case 'moodle-no-default-forum':
        responseError(404, res);
        break;
      case 'moodle-post-not-created':
        responseError(406, res);
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
