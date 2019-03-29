const express = require('express');

const { responseError, responseSuccess, handleError } = require('./helper');
const { tokenGatekeeper } = require('./auth');
const { rescind } = require('../notification');

const router = express.Router();

router.route('/').post(async (req, res) => {
  const { username, token } = req.body;
  try {
    if (username && token) {
      // check username and token are matched
      await tokenGatekeeper({ userId: username, token });

      rescind({ userId: username });

      responseSuccess({}, res, 204);
    } else {
      responseError(422, res);
    }
  } catch (e) {
    handleError(e, res);
  }
});

module.exports = router;
