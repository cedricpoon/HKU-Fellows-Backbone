const express = require('express');

const crawler = require('../moodle/crawler');
const { db } = require('../database/connect');
const { decrypt } = require('../security/safe');
const { responseError, responseSuccess, sortBy } = require('./helper');
const { postLimitPerLoad } = require('./config');
const filterMode = require('../constant/filter');
const { verifySignIn } = require('./auth');

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

const getCachedMoodlePosts = async (code, cookieString, index, username, filter) => {
  const moodlePosts = { offset: 0 };

  // return empty array if temperature (native ONLY)
  if (filter === filterMode.TEMPERATURE) return { ...moodlePosts, post: [] };

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
    switch (filter) {
      case filterMode.REPLIES:
        moodlePosts.post = moodlePosts.post.sort(sortBy.replies);
        break;
      default: // Sory by timestamp
        moodlePosts.post = moodlePosts.post.sort(sortBy.timestamp);
    }
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

const getNativePosts = async (code, index, time, offset, filter) => {
  // return empty array if moodle post ONLY
  if (filter === filterMode.MOODLE) return [];
  let orderBy;
  switch (filter) {
    case filterMode.TIMESTAMP:
      orderBy = 'Temperature';
      break;
    case filterMode.REPLIES:
      orderBy = 'ReplyNo';
      break;
    default:
      orderBy = 'Timestamp';
  }
  try {
    const topic = await db.query({
      sql: `
        select
          T.TopicId as TopicId,
          Solved,
          Title,
          Subtitle,
          Timestamp,
          Temperature,
          PrimaryHashtag,
          SecondaryHashtag,
          sum(case when T.TopicId = R.TopicId then 1 else 0 end) as ReplyNo
        from Topic T, Post P, Reply R
          where T.CourseId = ?
            and T.PostId = P.PostId
            and P.Timestamp <= FROM_UNIXTIME(? / 1000)
          group by T.TopicId
          order by ${orderBy} DESC
          limit ? offset ?
      `,
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
        temperature: dbobj.Temperature,
      };
      if (dbobj.PrimaryHashtag) resultobj.primaryHashtag = dbobj.PrimaryHashtag;
      if (dbobj.SecondaryHashtag) resultobj.secondaryHashtag = dbobj.SecondaryHashtag;
      resultobj.replyNo = dbobj.ReplyNo;
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
  const { time, filter: _filter } = req.query;

  const filter = _filter ? parseInt(_filter, 10) : filterMode.TIMESTAMP;

  if (!time) {
    responseError(422, res);
  } else {
    try {
      // check username and token are matched
      await verifySignIn({ userId: username, token });
      // check moodleKey is valid
      const cookieString = decrypt(moodleKey);
      const isLoggedIn = await crawler.proveLogin({
        cookieString,
      });
      if (isLoggedIn) {
        // get all moodle posts from cache
        const { post: moodlePosts, offset } = await getCachedMoodlePosts(
          code, cookieString, index, username, filter,
        );
        // get all native posts
        const nativePosts = await getNativePosts(code, index, time, offset, filter);
        // hybrid sort
        const result = nativePosts.concat(
          await sliceCachedMoodlePosts(moodlePosts, code, username, offset),
        )
          .sort(filter === filterMode.REPLIES ? sortBy.replies : sortBy.timestamp)
          .slice(0, postLimitPerLoad);
        // update offset
        updateOffset(result, code, username);
        responseSuccess(result, res, result.length === 0 ? 204 : 200);
      } else {
        responseError(408, res);
      }
    } catch (err) {
      switch (err.message) {
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
  }
});

module.exports = router;
