// -----------------------------------------------------
// | ALL routes located here are for internal use ONLY |
// -----------------------------------------------------
const express = require('express');

const { db } = require('../database/connect');
const { responseError, responseSuccess } = require('./helper');

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

module.exports = router;
