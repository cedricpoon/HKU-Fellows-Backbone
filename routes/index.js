const express = require('express');

const db = require('../database/connect');

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
router.route('/demo').get(async (req, res) => {
  try {
    const result = await db.query('select * from Demo');
    res.json({
      status: 200,
      payload: result,
    });
  } catch (err) {
    res.json({
      status: 502,
      error: 'Database connection failure',
    });
  }
});

module.exports = router;
