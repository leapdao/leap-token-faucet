const { it, describe, beforeEach } = require('mocha');

const chai = require('chai');
const { expect } = chai;

const TweetHandler = require('./tweetHandler');

const expectThrow = async (promise, message) => {
  try {
    await promise;
    expect.fail('Expected to throw');
  } catch (e) {
    expect(e.message).to.contain(message);
  }
};


const validTweet = 'Requesting faucet funds into 0x8db6B632D743aef641146DC943acb64957155388 on the #Rinkeby #Ethereum @leapdao test network.';

const validTweetData = {
  created_at: 'Sun Jun 17 08:52:13 +0000 2018',
  id: 1008271083080994800,
  id_str: '1008271083080994817',
  text: validTweet,
};

const validTweetUrl = 'https://twitter.com/JohBa/status/1008271083080994817';

describe('TweetHandler', () => {
  let queue, db, twitter;

  beforeEach(() => {
    db = {
      setAddr: () => {},
      getAddr: () => ({}),
    };
    
    queue = {
      put: (address) => { queue[address] = true; },
    };
    
    twitter = {
      get: (a, b, cb) => cb({ message: 'no withTweet call in the test' }),
    };
  });

  const handler = () => new TweetHandler(queue, twitter, db);

  const withTweet = tweet => {
    twitter.get = (a, b, cb) => cb(null, { ...validTweetData, text: tweet });
  }

  it('should throw on invalid url', async () => {
    await expectThrow(
      handler().handleTweet('bla-com', 200),
      'Bad Request: url bla-com not valid.'
    );
  });

  it('should throw on invalid tweet URL', async () => {
    await expectThrow(
      handler().handleTweet('https://twitter.com/JohBa/status/abc', 200),
      'Bad Request: could not parse tweet id'
    );
  });

  it('should throw if no address in tweet', async () => {
    withTweet('Requesting @leapdao tokens');
    await expectThrow(
      handler().handleTweet(validTweetUrl, 200),
      'Bad Request: Tweet should include valid Ethereum address'
    );
  });

  it('should throw on invalid address in tweet', async () => {
    withTweet('Requesting into 0x00 @leapdao');
    await expectThrow(
      handler().handleTweet(validTweetUrl, 200),
      'Bad Request: Tweet should include valid Ethereum address'
    );
  });

  it('should throw if no @leapdao handle in tweet', async () => {
    withTweet('Requesting into 0x8db6B632D743aef641146DC943acb64957155388');
    await expectThrow(
      handler().handleTweet(validTweetUrl, 200),
      'Bad Request: Tweet should be mentioning @Leapdao'
    );
  });

  describe('valid tweet', () => {
    it('should throw if time too short', async () => {
      withTweet(validTweet);
      db.getAddr = () => ({ created: new Date() });
  
      await expectThrow(
        handler().handleTweet(validTweetUrl, 200),
        'Bad Request: not enough time passed since the last claim'
      );
  
      expect(queue['0x8db6B632D743aef641146DC943acb64957155388']).to.be.undefined;
    });
  
    it('should put address into sending queue if tweet is reused', async () => {
      withTweet(validTweet);
      const earlier = new Date();
      earlier.setHours(-25);
      db.getAddr = () => ({ created: earlier });
  
      await handler().handleTweet(validTweetUrl, 200);
  
      expect(queue['0x8db6B632D743aef641146DC943acb64957155388']).to.be.true;
    });

    it('should put address into sending queue', async () => {
      withTweet(validTweet);
  
      await handler().handleTweet(validTweetUrl, 200);
  
      expect(queue['0x8db6B632D743aef641146DC943acb64957155388']).to.be.true;
    });


  })


});
