const { db } = require('../../database/connect');
const crawler = require('../../moodle/crawler');
const { decrypt } = require('../../security/safe');

async function tokenGatekeeper({ userId, token }) {
  // check username and token are matched
  const user = await db.query({
    sql: `select count(*) as count from User
            where upper(UserId) = ? and Token = ?`,
    values: [userId.toLowerCase(), token],
  });
  if (user[0].count === 0) {
    throw new Error('login-error');
  }
}

async function moodleKeyValidator({ moodleKey }) {
  const cookieString = decrypt(moodleKey);
  if (!await crawler.proveLogin({ cookieString })) throw new Error('moodle-key-timeout');
}

module.exports = { tokenGatekeeper, moodleKeyValidator };
