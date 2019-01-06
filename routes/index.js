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

module.exports = router;
