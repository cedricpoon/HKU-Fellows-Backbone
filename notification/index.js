const { db } = require('../database/connect');
const { rescind: _rescind, register: _register } = require('./sns');

async function rescind({ userId }) {
  let arn;
  try {
    const [{ ARN: _arn }] = await db.query({
      sql: 'select ARN from User where UserId = ?',
      values: [userId],
    });
    arn = _arn;
  } catch (e) {
    throw new Error('database-error');
  }
  if (arn) _rescind({ arn });
}

async function register({ fcmToken, userId, token }) {
  const arn = await _register({ fcmToken, userMeta: `${userId}::${token}` });
  try {
    await db.query({
      sql: `update User set ARN = ?
              where UserId = ?`,
      values: [arn, userId],
    });
  } catch (e) {
    throw new Error('database-error');
  }
}

module.exports = { rescind, register };
