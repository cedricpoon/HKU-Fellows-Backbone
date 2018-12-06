var express = require('express');
var router = express.Router();

/* hello world placeholder */
router.all('/', function(req, res, next) {
  res.json({
    app: 'hkuf-backbone',
    status: res.statusCode,
    message: 'Hello World!'
  });
});

module.exports = router;
