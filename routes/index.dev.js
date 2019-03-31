// -----------------------------------------------------
// | ALL routes located here are for internal use ONLY |
// -----------------------------------------------------
const express = require('express');

const { db } = require('../database/connect');
const { responseError, responseSuccess, handleError } = require('./helper');
const { broadcast } = require('../notification');

const router = express.Router();

/* RDS connection test */
router.route('/database').get(async (req, res) => {
  try {
    const result = await db.query('select * from Demo');
    responseSuccess(result, res);
  } catch (err) {
    responseError(502, res);
  }
});

router.route('/broadcastTopic/:topicId').get(async (req, res) => {
  try {
    const { topicId } = req.params;
    await broadcast({ topicId });
    responseSuccess({ sent: true }, res);
  } catch (e) {
    handleError(e, res);
  }
});

module.exports = router;
