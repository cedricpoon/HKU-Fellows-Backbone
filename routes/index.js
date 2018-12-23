const express = require('express');

const router = express.Router();

const crawler = require('../auth/crawler');

router.route('/moodle').get((req, res) => {
  crawler.moodle()
    .then((d) => { res.send(d); })
    .catch((e) => { res.send(e); });
});

router.route('/checkAuth').get((req, res) => {
  crawler.check(req.query.ticket)
    .then((d) => { res.send(d); })
    .catch((e) => { res.send(e); });
});

router.route('/auth').post((req, res) => {
  crawler.crawl(req.body.username, req.body.password)
    .then((data) => {
      if (data.status === 200) {
        res.json({
          status: 200,
          payload: {
            ticket: data.ticket,
          },
        });
      } else {
        res.json({
          status: 401,
          error: 'Authentication failure',
        });
      }
    })
    .catch((error) => {
      console.error(error);
      res.json({
        status: 503,
        error: 'Crawling failure',
      });
    });
});

router.route('/').all((req, res) => {
  res.json({
    status: res.statusCode,
    payload: 'ಠ___ಠ',
  });
});

/* RDS connection test */
router.route('/demo').all((req, res) => {
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
