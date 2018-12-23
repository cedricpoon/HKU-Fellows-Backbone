const express = require('express');

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
router.route('/demo').get((req, res) => {
  req.db.query('select * from Demo', (err, result) => {
    if (err) {
      console.log(err);
      res.json({
        status: 500,
        error: 'RDS not connected',
      });
    } else {
      res.json({
        status: 200,
        payload: result,
      });
    }
  });
});

module.exports = router;
