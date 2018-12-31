const express = require('express');

const crawler = require('../moodle/crawler');
const db = require('../database/connect');
const { decrypt, encrypt, hash } = require('../auth/safe');
const { responseError, responseSuccess } = require('./helper.js');

const router = express.Router();


router.route('/:code/:index').post(async (req, res) => {
  const { code, index } = req.params;
  const { username, token, moodleKey } = req.body;

  try {
    const user = await db.query({
      sql: `select count(*) as count from User
        where UserId = ? and Token = ?`,
      values: [username, token],
    });
    if (user[0].count === 0) {
      responseError(401, res);
    } else {
      crawler.proveLogin({
        cookieString: decrypt(moodleKey),
      })
        .then(async (isLoggedIn) => {
          if (isLoggedIn) {
            try {
              const topic = await db.query(
                `select * from Topic T, Post P
                where T.CourseId='${code.toUpperCase()}'
                and T.PostId = P.PostId
                LIMIT ${(parseInt(index, 10) - 1) * 20}, 20`,
              );
              const result = [];
              for (let i = 0; i < topic.length; i += 1) {
                const dbobj = topic[i];
                const resultobj = {};

                resultobj.id = dbobj.TopicId;
                resultobj.native = true;
                resultobj.solved = dbobj.Solved;
                resultobj.title = dbobj.Title;
                resultobj.subtitle = dbobj.Subtitle;
                if (dbobj.PrimaryHashtag) resultobj.primaryHashtag = dbobj.PrimaryHashtag;
                if (dbobj.SecondaryHashtag) resultobj.secondaryHashtag = dbobj.SecondaryHashtag;
                resultobj.timestamp = dbobj.Timestamp;
                const reply = await db.query(`select count(*) as count from Reply where TopicId = ${dbobj.TopicId}`);
                resultobj.replyNo = reply[0].count;
                result.push(resultobj);
              }
              responseSuccess(result, res, result.length === 0 ? 204 : 200);
            } catch (err) {
              responseError(502, res);
            }
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
