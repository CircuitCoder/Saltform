import * as backend from './backend';
import { promisify } from 'util';
import redis from 'redis';

const client = redis.createClient();
const smembers = promisify(client.smembers).bind(client);

async function doLogin() {
  let first = true;
  while(true) {
    const result = await backend.login(!first);
    if(result) break;
  }

  console.log('Login completed');
}

async function work() {
  await doLogin();

  const kws = await smembers('keywords');
  for(const kw of kws) {
    const result = await backend.query(kw);

    console.log(result);
  }
}

work();
