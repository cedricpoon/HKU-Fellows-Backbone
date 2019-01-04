const express = require('express');

const crawler = require('../moodle/crawler');
const { db, cachedb } = require('../database/connect');
const { decrypt } = require('../auth/safe');
const { responseError, responseSuccess } = require('./helper');

const router = express.Router();

const getMoodlePosts = async (code, cookieString) => {
  const courses = await crawler.getCourses({
    cookieString,
  });
  if (courses) {
    let course;
    for (let i = 0; i < courses.length; i += 1) {
      if (courses[i].id === code.toUpperCase()) {
        course = courses[i];
        break;
      }
    }
    if (course) {
      const posts = await crawler.retrievePostsFromCourse({
        cookieString,
        coursePath: course.path,
      });
      return posts;
    }
  }
  return [];
};

const getNativePosts = async (code) => {
  try {
    const topic = await db.query(
      `select * from Topic T, Post P
        where T.CourseId='${code.toUpperCase()}'
        and T.PostId = P.PostId
        order by P.Timestamp DESC`,
    );
    const resultPosts = [];
    for (let i = 0; i < topic.length; i += 1) {
      const dbobj = topic[i];
      const resultobj = {
        id: dbobj.TopicId,
        native: true,
        solved: dbobj.Solved,
        title: dbobj.Title,
        subtitle: dbobj.Subtitle,
        timestamp: dbobj.Timestamp,
      };
      if (dbobj.PrimaryHashtag) resultobj.primaryHashtag = dbobj.PrimaryHashtag;
      if (dbobj.SecondaryHashtag) resultobj.secondaryHashtag = dbobj.SecondaryHashtag;
      // eslint-disable-next-line no-await-in-loop
      const reply = await db.query(`select count(*) as count from Reply where TopicId = ${dbobj.TopicId}`);
      resultobj.replyNo = reply[0].count;
      resultPosts.push(resultobj);
    }
    return resultPosts;
  } catch (e) {
    throw new Error('database-error');
  }
};

router.route('/:code/:index').post(async (req, res) => {
  const { code, index } = req.params;
  const { username, token, moodleKey } = req.body;

  try {
    // check username and token are matched
    const user = await db.query({
      sql: `select count(*) as count from User
              where upper(UserId) = ? and Token = ?`,
      values: [username.toLowerCase(), token],
    });
    if (user[0].count === 0) {
      responseError(401, res);
    } else {
      // check moodleKey is valid
      const cookieString = decrypt(moodleKey);
      const isLoggedIn = await crawler.proveLogin({
        cookieString,
      });
      if (isLoggedIn) {
        let moodlePosts;
        if (index === '1') {
          // get all moodle posts from course
          moodlePosts = getMoodlePosts(code, cookieString);
          await cachedb.query(
            `delete from MoodleCache
              where UserId = '${username}' and CourseId = '${code.toUpperCase()}'`,
          );
          const moodleStr = JSON.stringify(await moodlePosts);
          await cachedb.query({
            sql: `insert into MoodleCache(Data, UserId, CourseId)
                  values (?, ?, ?)`,
            values: [moodleStr, username, code.toUpperCase()],
          });
        } else {
          moodlePosts = await cachedb.query(
            `select Data from MoodleCache
              where UserId = '${username}' and CourseId = '${code.toUpperCase()}'`,
          );
          moodlePosts = JSON.parse(moodlePosts[0].Data);
        }
        // get all native posts
        const nativePosts = getNativePosts(code, index);
        // hybrid sort
        const posts = await Promise.all([moodlePosts, nativePosts]);

        const result = [].concat(...posts).sort((a, b) => {
          const aTime = new Date(a.timestamp);
          const bTime = new Date(b.timestamp);

          return bTime - aTime;
        }).slice((index - 1) * 20, (index - 1) * 20 + 20);
        responseSuccess(result, res, result.length === 0 ? 204 : 200);
      } else {
        responseError(408, res);
      }
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
