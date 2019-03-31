const AWS = require('aws-sdk');
const removeMd = require('remove-markdown');

const { aws, snsArn } = require('./config');
const { addSlashes, limit, noNewline } = require('./helper');

function configureAWS() {
  const { accessKeyId, secretAccessKey } = aws;
  if (accessKeyId && secretAccessKey) {
    AWS.config.update({ ...aws });
    return;
  }
  throw new Error('no-aws-env-var');
}

function createSNS() {
  try {
    configureAWS();
    return new AWS.SNS();
  } catch (e) {
    return null;
  }
}

const sns = createSNS();

function register({ fcmToken, userMeta }) {
  return new Promise((resolve, reject) => {
    if (!sns || !snsArn) reject(new Error('no-aws-sns-service'));

    const params = {
      PlatformApplicationArn: snsArn,
      Token: fcmToken,
      CustomUserData: userMeta,
    };
    sns.createPlatformEndpoint(params, (err, data) => {
      if (err || data == null) reject(new Error('no-aws-sns-service'));
      else resolve(data.EndpointArn);
    });
  });
}

function rescind({ arn }) {
  return new Promise((resolve, reject) => {
    if (!sns) reject(new Error('no-aws-sns-service'));

    sns.deleteEndpoint({ EndpointArn: arn }, (err, data) => {
      if (err || data == null) reject(new Error('no-aws-sns-service'));
      else resolve();
    });
  });
}

function update({ arn, attributes: Attributes }) {
  return new Promise((resolve, reject) => {
    if (!sns) reject(new Error('no-aws-sns-service'));

    sns.setEndpointAttributes({ EndpointArn: arn, Attributes }, (err, data) => {
      if (err || data == null) reject(new Error('no-aws-sns-service'));
      else resolve();
    });
  });
}

function f(s) {
  return addSlashes(noNewline(limit(removeMd(s))));
}

function notify({
  arn, content, title, payload: _payload,
}) {
  return new Promise((resolve, reject) => {
    if (!sns) reject(new Error('no-aws-sns-service'));
    const payload = _payload ? `, "data": ${JSON.stringify(_payload)}` : '';
    const message = {
      GCM: `{ "notification": { "title": "${f(title)}", "text": "${f(content)}" } ${payload} }`,
    };
    console.log(message);
    const params = {
      Message: JSON.stringify(message),
      MessageStructure: 'json',
      TargetArn: arn,
    };
    sns.publish(params, (err, data) => {
      if (err || data == null) reject(new Error('no-aws-sns-service'));
      else resolve(data.MessageId);
    });
  });
}

module.exports = {
  sns, register, rescind, notify, update,
};
