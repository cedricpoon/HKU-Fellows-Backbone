const { db } = require('../../database/connect');

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

module.exports = { tokenGatekeeper };
