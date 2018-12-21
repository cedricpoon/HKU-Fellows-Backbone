var express = require('express');
var router = express.Router();

router.route('/').all(function(req, res, next) {
  res.json({
    status: res.statusCode,
    payload: 'ಠ___ಠ'
  });
});

/* RDS connection test */
router.route('/demo').all(function(req, res, next) {

  req.db.query("select * from Demo", function (err, result) {
    if (err) {
      console.log(err);
      res.json({
        status: res.statusCode,
        payload: []
      });
    } else {
      res.json({
        status: res.statusCode,
        payload: result
      });
    }
  });
});

module.exports = router;
