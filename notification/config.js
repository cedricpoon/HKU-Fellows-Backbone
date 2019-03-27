const awsConfig = {
  region: 'ap-northeast-1',
  accessKeyId: process.env.SNS_ACCESS_ID,
  secretAccessKey: process.env.SNS_SECRET_KEY,
};

module.exports = {
  aws: awsConfig,
  snsArn: process.env.SNS_ARN,
};
