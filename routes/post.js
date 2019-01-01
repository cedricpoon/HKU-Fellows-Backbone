const express = require('express');

const crawler = require('../moodle/crawler');
const db = require('../database/connect');
const { decrypt } = require('../auth/safe');
const { responseError, responseSuccess } = require('./helper.js');

const router = express.Router();


router.route('/:code/:index').post(async (req, res) => {
  const { code, index } = req.params;
  const { username, token, moodleKey } = req.body;

  try {
    // check username and token are matched
    const user = await db.query({
      sql: `select count(*) as count from User
        where UserId = ? and Token = ?`,
      values: [username, token],
    });
    if (user[0].count === 0) {
      responseError(401, res);
    } else {
      // check moodleKey is valid
      const cookieString = decrypt(moodleKey);
      crawler.proveLogin({
        cookieString,
      })
        .then(async (isLoggedIn) => {
          if (isLoggedIn) {
            const moodlePosts = new Promise((resolve, reject) => {
              let courses = [];
              let posts = [];

              crawler.getCourses({
                cookieString,
              })
                .then((_courses) => {
                  courses = _courses;
                })
                .then(async () => {
                  let course = {};
                  for (let i = 0; i < courses.length; i += 1) {
                    if (courses[i].id === code.toUpperCase()) {
                      course = courses[i];
                      break;
                    }
                  }
                  posts = await crawler.retrievePostsFromCourse({
                    cookieString,
                    coursePath: course.path,
                  });
                })
                .then(() => {
                  resolve(posts);
                })
                .catch((e) => {
                  reject(e);
                });
            });

            const nativePosts = new Promise(async (resolve, reject) => {
              try {
                const topic = await db.query(
                  `select * from Topic T, Post P
                  where T.CourseId='${code.toUpperCase()}'
                  and T.PostId = P.PostId
                  order by P.Timestamp DESC
                  LIMIT ${(parseInt(index, 10) - 1) * 20}, 20`,
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
                  const reply = await db.query(`select count(*) as count from Reply where TopicId = ${dbobj.TopicId}`);
                  resultobj.replyNo = reply[0].count;
                  resultPosts.push(resultobj);
                }
                resolve(resultPosts);
              } catch (err) {
                reject(err, 502);
              }
            });

            Promise.all([moodlePosts, nativePosts])
              .then((posts) => {
                let result = [].concat(...posts);
                result = result.sort((a, b) => {
                  const aTime = new Date(a.timestamp);
                  const bTime = new Date(b.timestamp);

                  return bTime - aTime;
                });
                responseSuccess(result, res, result.length === 0 ? 204 : 200);
              })
              .catch((e, n) => {
                responseError(n === 502 ? 502 : 500, res);
              });
          } else {
            responseError(408, res);
          }
        })
        .catch(() => {
          responseError(500, res);
        });
    }
  } catch (err) {
    responseError(502, res);
  }
});

module.exports = router;
