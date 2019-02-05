const crawler = require('../../moodle/crawler');
const { db } = require('../../database/connect');

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

module.exports = { checkLogin };
