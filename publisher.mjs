import Config from './config';
import AWS from 'aws-sdk';

AWS.config.update({ region: Config.sns.region });
const SNS = new AWS.SNS({ apiVersion: '2010-03-31' });

export async function publish(msg) {
  await SNS.publish({
    TopicArn: Config.sns.arn,
    Message: msg,
  }).promise();
}
