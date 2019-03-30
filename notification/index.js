const { db } = require('../database/connect');
const sns = require('./sns');

async function rescind({ userId }) {
  try {
    const result = await db.query({
      sql: `select ARN, DM.FCM as FCM
              from User as U, DeviceMap as DM
              where UserId = ? and U.FCM = DM.FCM`,
      values: [userId],
    });
    if (result.length > 0) {
      const [{ ARN: arn, FCM: fcm }] = result;
      sns.rescind({ arn });
      await db.query({
        sql: 'update User set FCM = NULL where UserId = ?',
        values: [userId],
      });
      db.query({
        sql: 'delete from DeviceMap where FCM = ?',
        values: [fcm],
      });
    }
  } catch (e) {
    if (e.message === 'no-aws-sns-service') throw (e);
    else throw new Error('database-error');
  }
}

async function register({ fcmToken, userId, token }) {
  try {
    const result = await db.query({
      sql: `select ARN
              from DeviceMap
              where FCM = ?`,
      values: [fcmToken],
    });
    const userMeta = `${userId}::${token.substring(0, 7)}`;
    if (result.length === 0) {
      const arn = await sns.register({ fcmToken, userMeta });
      await db.query({
        sql: 'insert into DeviceMap set ?',
        values: [{ FCM: fcmToken, ARN: arn }],
      });
    } else {
      await db.query({
        sql: 'update User set FCM = NULL where FCM = ?',
        values: [fcmToken],
      });
      const [{ ARN: arn }] = result;
      sns.update({ arn, attributes: { CustomUserData: userMeta } });
    }
    db.query({
      sql: `update User set FCM = ?
              where UserId = ?`,
      values: [fcmToken, userId],
    });
  } catch (e) {
    if (e.message === 'no-aws-sns-service') throw (e);
    else throw new Error('database-error');
  }
}

module.exports = { rescind, register };
