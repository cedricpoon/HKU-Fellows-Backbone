const express = require('express');

const { db } = require('../database/connect');
const { responseSuccess, handleError } = require('./helper');
const { tokenGatekeeper } = require('./auth');

const router = express.Router();

const queryTemperature = async (userId) => {
  try {
    const result = await db.query({
      sql: `select sum(Temperature) as Temperature
              from Post
              where Author = ?`,
      values: [userId],
    });
    return { temperature: result[0].Temperature };
  } catch (e) {
    throw new Error('database-error');
  }
};

router.route('/temperature').post(async (req, res) => {
  const { username, token } = req.body;

  try {
    // check username and token are matched
    await tokenGatekeeper({ userId: username, token });

    const result = await queryTemperature(username);
    responseSuccess(result, res);
  } catch (err) {
    handleError(err, res);
  }
});

module.exports = router;
