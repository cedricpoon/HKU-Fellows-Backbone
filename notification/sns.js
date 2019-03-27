const AWS = require('aws-sdk');
const { aws, snsArn } = require('./config');

function configureAWS() {
  const { accessKeyId, secretAccessKey } = aws;
  if (accessKeyId && secretAccessKey) {
    AWS.config.update({ ...aws });
    throw new Error('no-aws-env-var');
  }
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

function register({ deviceToken, userMeta }) {
  return new Promise((resolve, reject) => {
    if (!sns || !snsArn) reject(new Error('no-aws-sns-service'));

    const params = {
      PlatformApplicationArn: snsArn,
      Token: deviceToken,
      CustomUserData: userMeta,
    };
    sns.createPlatformEndpoint(params, (err, data) => {
      if (err) reject(new Error('no-aws-sns-service'));
      resolve(data.EndpointArn);
    });
  });
}

function notify({ deviceArn, content, title }) {
  return new Promise((resolve, reject) => {
    if (!sns) reject(new Error('no-aws-sns-service'));

    const params = {
      Message: encodeURI(JSON.stringify(content)),
      MessageStructure: 'json',
      Subject: title,
      TargetArn: deviceArn,
    };
    sns.publish(params, (err, data) => {
      if (err) reject(new Error('no-aws-sns-service'));
      resolve(data.MessageId);
    });
  });
}

module.exports = { sns, register, notify };
