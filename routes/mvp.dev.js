// -----------------------------------------------------
// | ALL routes located here are for internal use ONLY |
// -----------------------------------------------------
const express = require('express');

const crawler = require('../moodle/crawler');
const { decrypt } = require('../security/safe');
const {
  responseError,
  responseSuccess,
} = require('./helper');

const router = express.Router();

router.route('/:postId').post(async (req, res) => {
  const { postId } = req.params;
  const { cookieString } = req.body;

  try {
    const result = await crawler.visitPost({ cookieString: decrypt(cookieString), postId });
    responseSuccess(result, res, 200);
  } catch (e) {
    console.log(e);
    switch (e.message) {
      case 'moodle-not-enrolled':
        responseError(412, res);
        break;
      default:
        responseError(500, res);
    }
  }
});

module.exports = router;
