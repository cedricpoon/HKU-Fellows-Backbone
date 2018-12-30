const express = require('express');

const db = require('../database/connect');
const { responseError, responseSuccess } = require('./helper.js');

const router = express.Router();

router.route('/').get((req, res) => {
  res.json({
    status: res.statusCode,
    payload: {
      message: 'ಠ___ಠ',
    },
  });
});

/* RDS connection test */
router.route('/database').get(async (req, res) => {
  try {
    const result = await db.query('select * from Demo');
    responseSuccess(result, res);
  } catch (err) {
    responseError(502, res);
  }
});

// -----------------------------------------------
//  Example of crawling all posts from a course
// -----------------------------------------------
// router.route('/test/:idx').post((req, res) => {
//   let courses = [];
//   let posts = [];
//   const { idx } = req.params;
//   const cookieString = decrypt(req.body.moodleKey);
//
//   crawler.getCourses({ cookieString })
//     .then((_courses) => {
//       courses = _courses;
//     })
//     .then(async () => {
//       posts = await crawler.retrievePostsFromCourse({
//         cookieString,
//         coursePath: courses[idx].path,
//       });
//     })
//     .then(() => {
//       res.json(posts);
//     })
//     .catch((e) => {
//       res.json(e);
//     });
// });

module.exports = router;
