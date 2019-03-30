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

async function subscribeTopic({ userId, topicId }) {
  try {
    await db.query({
      sql: 'insert into TopicRegistry set ?',
      values: [{ TopicId: topicId, UserId: userId }],
    });
  } catch (e) {
    throw new Error('database-error');
  }
}

async function unsubscribeTopic({ userId, topicId }) {
  try {
    await db.query({
      sql: 'delete from TopicRegistry where UserId = ? and TopicId = ?',
      values: [userId, topicId],
    });
  } catch (e) {
    throw new Error('database-error');
  }
}

async function broadcast({ topicId, replierId: _replierId }) {
  try {
    const replierId = _replierId || '';
    const arnList = await db.query({
      sql: `select ARN, Title, Content
              from
                (select T.Title as Title, P.Content as Content
                  from Topic as T
                    inner join Reply as R on R.TopicId = T.TopicId
                    inner join Post as P on P.PostId = R.PostId
                  where T.TopicId = ?
                  order by P.Timestamp desc
                  limit 1) as A,
                DeviceMap as DM
                  inner join User as U on U.FCM = DM.fcm
                  inner join TopicRegistry as TR on U.UserId = TR.UserId
              where
                TR.TopicId = ? and
                U.UserId <> ?`,
      values: [topicId, topicId, replierId],
    });
    const notices = [];
    for (let i = 0; i < arnList.length; i += 1) {
      const { ARN: arn, Title: title, Content: content } = arnList[i];
      notices.push(sns.notify({ arn, content, title: `Re: ${title}` }));
    }
    await Promise.all(notices);
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

module.exports = {
  rescind,
  register,
  subscribeTopic,
  unsubscribeTopic,
  broadcast,
};
