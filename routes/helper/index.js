const statusMsg = require('../status/messages');
const crawler = require('../../moodle/crawler');
const { db } = require('../../database/connect');

function responseError(code, response) {
  response.json({
    status: code,
    error: statusMsg[`${code}`],
  });
}

function responseSuccess(payload, response, status = 200) {
  response.json({
    status,
    payload,
  });
}

const checkLogin = async (username, token, cookieString) => {
  // check username and token are matched
  const user = await db.query({
    sql: `select count(*) as count from User
            where upper(UserId) = ? and Token = ?`,
    values: [username.toLowerCase(), token],
  });
  if (user[0].count === 0) {
    return 401;
  }
  // check moodleKey is valid
  const isLoggedIn = await crawler.proveLogin({
    cookieString,
  });
  if (isLoggedIn) {
    return 200;
  }
  return 408;
};

function sortByTimestamp(a, b) {
  const aTime = new Date(a.timestamp);
  const bTime = new Date(b.timestamp);

  return bTime - aTime;
}

module.exports = {
  responseError,
  responseSuccess,
  checkLogin,
  sortByTimestamp,
};
