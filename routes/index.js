var express = require('express');
var router = express.Router();

/* hello world placeholder */
router.all('/', function(req, res, next) {

  req.db.query("select * from Demo limit 1", function (err, result) {
    if (err) {
      console.log(err);
      res.json({
        app: 'hkuf-backbone',
        status: res.statusCode,
        payload: {}
      });
    } else {
      res.json({
        app: 'hkuf-backbone',
        status: res.statusCode,
        payload: result
      });
    }
  });
});

module.exports = router;
