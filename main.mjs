import * as backend from './backend';
import * as publisher from './publisher';
import { promisify } from 'util';
import redis from 'redis';

const client = redis.createClient();
const METHODS = ['smembers', 'setnx'];
const db = {};
for(const m of METHODS)
  db[m] = promisify(client[m]).bind(client);

async function doLogin() {
  let first = true;
  while(true) {
    const result = await backend.login(!first);
    if(result) break;
    first = false;
  }

  console.log('Login completed');
}

async function work() {
  await doLogin();

  const kws = await db.smembers('keywords');
  for(const kw of kws) {
    let page = 1;
    let count = 0;
    while(true) {
      console.log(`Fetching: ${kw} of page ${page}`);

      const result = await backend.query(kw, page);

      let done = false;

      if(result.length === 0) {
        done = true;
        break;
      }

      for(const entry of result) {
        const match = entry.link.match(/[?&]id=(\d+)($|&)/);
        if(!match) {
          console.error('Cannot extract ID:');
          console.error(entry);

          continue;
        }

        const id = match[1];

        const resp = await db.setnx(`entry:${id}`, JSON.stringify(entry));
        if(resp === 0) done = true;
        else {
          console.log(`New entry: ${id}`);
          ++count;
        }
      }

      if(done) break;
      ++page;
    }

    if(count !== 0)
      await publisher.publish(`${count} new items found: ${kw}`);
  }

  await backend.destroy();
  process.exit(0);
}

work();
