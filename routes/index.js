const express = require('express');

const db = require('../database/connect');
const { responseError, responseSuccess } = require('./helper');

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

module.exports = router;
