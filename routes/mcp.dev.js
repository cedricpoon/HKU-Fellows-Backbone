// --------------------------------------
//  Compose Post to Moodle Example Usage
// --------------------------------------
const express = require('express');

const crawler = require('../moodle/crawler');
const { decrypt } = require('../security/safe');
const {
  moodleCoursePath,
} = require('../moodle/urls');
const {
  responseError,
  responseSuccess,
} = require('./helper');
const { moodleKeyValidator } = require('./auth');

const router = express.Router();

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

router.route('/:courseId').post(async (request, response) => {
  const { courseId } = request.params;
  const { moodleKey, title, content } = request.body;
  const cookieString = decrypt(moodleKey);

  try {
    await moodleKeyValidator({ moodleKey });

    const coursePath = await resolveCoursePathFromCode(courseId, cookieString);
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

    if (newPost) {
      responseSuccess(newPost, response, newPost ? 200 : 204);
    }
  } catch (e) {
    console.log(e);

    switch (e.message) {
      case 'moodle-not-enrolled':
        responseError(412, response);
        break;
      case 'moodle-no-default-forum':
        responseError(404, response);
        break;
      case 'moodle-post-not-created':
        responseError(406, response);
        break;
      case 'moodle-key-timeout':
        responseError(408, response);
        break;
      default:
        responseError(500, response);
    }
  }
});

module.exports = router;
