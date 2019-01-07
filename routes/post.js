const express = require('express');

const crawler = require('../moodle/crawler');
const { db } = require('../database/connect');
const { decrypt } = require('../auth/safe');
const { responseError, responseSuccess, sortByTimestamp } = require('./helper');
const { postLimitPerLoad } = require('./config');

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

const getCachedMoodlePosts = async (code, cookieString, index, username) => {
  const moodlePosts = { offset: 0 };

  if (index === '1') {
    const promised = await Promise.all([
      // get all moodle posts from course
      getMoodlePosts(code, cookieString),
      db.query({
        sql: `delete from MoodleCache
                where UserId = ?`,
        values: [username, code.toUpperCase()],
      }),
    ]);
    [moodlePosts.post] = promised;
    // sorting
    moodlePosts.post = moodlePosts.post.sort(sortByTimestamp);
    const moodleStr = JSON.stringify(moodlePosts.post);
    // insert cache
    await db.query({
      sql: `insert into MoodleCache(Data, UserId, CourseId)
            values (?, ?, ?)`,
      values: [moodleStr, username, code.toUpperCase()],
    });
  } else {
    // get from cache
    const result = await db.query({
      sql: `select Data, Offset from MoodleCache
              where UserId = ? and CourseId = ?`,
      values: [username, code.toUpperCase()],
    });
    moodlePosts.post = JSON.parse(result[0].Data);
    moodlePosts.offset = result[0].Offset;
  }

  return moodlePosts;
};

const getNativePosts = async (code, index, time, offset) => {
  try {
    const topic = await db.query({
      sql: `select * from Topic T, Post P
              where T.CourseId = ?
              and T.PostId = P.PostId
              and P.Timestamp <= FROM_UNIXTIME(? / 1000)
              order by P.Timestamp DESC
              limit ? offset ?`,
      values: [
        code.toUpperCase(),
        time,
        postLimitPerLoad,
        (parseInt(index, 10) - 1) * postLimitPerLoad - offset,
      ],
    });
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
        temperature: 0, // TODO: calculation and update of temperature
      };
      if (dbobj.PrimaryHashtag) resultobj.primaryHashtag = dbobj.PrimaryHashtag;
      if (dbobj.SecondaryHashtag) resultobj.secondaryHashtag = dbobj.SecondaryHashtag;
      // eslint-disable-next-line no-await-in-loop
      const reply = await db.query({
        sql: 'select count(*) as count from Reply where TopicId = ?',
        values: [dbobj.TopicId],
      });
      resultobj.replyNo = reply[0].count;
      resultPosts.push(resultobj);
    }
    return resultPosts;
  } catch (e) {
    throw new Error('database-error');
  }
};

const sliceCachedMoodlePosts = async (array, code, username, number) => {
  const data = array.slice(number);
  if (number > 0) {
    await db.query({
      sql: `update MoodleCache set Data = ?
              where UserId = ? and CourseId = ?`,
      values: [
        JSON.stringify(data),
        username,
        code.toUpperCase(),
      ],
    });
  }
  return data;
};

const updateOffset = async (array, code, username) => {
  const newOffset = array.filter(record => !record.native).length;
  await db.query({
    sql: `update MoodleCache set Offset = ?
            where UserId = ? and CourseId = ?`,
    values: [newOffset, username, code.toUpperCase()],
  });
};

router.route('/:code/:index').post(async (req, res) => {
  const { code, index } = req.params;
  const { username, token, moodleKey } = req.body;
  const { time } = req.query;

  if (!time) {
    responseError(422, res);
  } else {
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
          // get all moodle posts from cache
          const { post: moodlePosts, offset } = await getCachedMoodlePosts(
            code, cookieString, index, username,
          );
          // get all native posts
          const nativePosts = await getNativePosts(code, index, time, offset);
          // hybrid sort
          const result = nativePosts.concat(
            await sliceCachedMoodlePosts(moodlePosts, code, username, offset),
          ).sort(sortByTimestamp).slice(0, postLimitPerLoad);
          // update offset
          updateOffset(result, code, username);
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
  }
});

module.exports = router;
