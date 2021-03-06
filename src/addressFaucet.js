/**
 * Copyright (c) 2018-present, Leap DAO (leapdao.org)
 *
 * This source code is licensed under the Mozilla Public License Version 2.0
 * found in the LICENSE file in the root directory of this source tree.
 */

const AWS = require('aws-sdk');
const { isValidAddress } = require('ethereumjs-util');
const { Queue, Errors } = require('leap-lambda-boilerplate');
const Db = require('./utils/db');

exports.handler = async (event, context) => {
  const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  const address = body.address;
  const color = parseInt(body.color) || 0;

  const awsAccountId = context.invokedFunctionArn.split(':')[4];
  const queueUrl = `https://sqs.${process.env.REGION}.amazonaws.com/${awsAccountId}/${process.env.QUEUE_NAME}`;

  const queue = new Queue(new AWS.SQS(), queueUrl);
  const db = new Db(process.env.TABLE_NAME);
  
  if (!isValidAddress(address)) {
    throw new Errors.BadRequest(`Not a valid Ethereum address: ${address}`);
  }

  const { created } = await db.getAddr(address);
  const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
  if (dayAgo < created) {
    throw new Errors.BadRequest(`not enough time passed since the last claim`);
  }

  await queue.put(JSON.stringify({address, color}));
  await db.setAddr(address);

  return { 
    statusCode: 200,
    body: { address, color }
  };
};
