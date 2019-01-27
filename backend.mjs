import puppeteer from 'puppeteer-core';
import Config from './config';

const CHROME_EXEC = process.env.CHROME_EXEC || undefined;
const CHROME_USERDATA = process.env.CHROME_USERDATA || undefined;

async function bootstrap() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_EXEC,
    userDataDir: CHROME_USERDATA,
    headless: false,
    args: [
      '--no-sandbox',
      '--auto-open-devtools-for-tabs',
//      '--headless',
      '--hide-scrollbars',
      '--mute-audio',
    ],
  });

  return browser;
}

const UNAME = Config.taobao.uname;
const PASSWORD = Config.taobao.pass;

const browserHandle = bootstrap();

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function handleSlider(page) {
  const hasSlider = await page.evaluate(() => {
    return !!document.getElementById('nc_1_n1z');
  });

  if(!hasSlider) return false;
  console.log('Got slider');

  const { x, y } = await page.evaluate(() => {
    const slider = document.getElementById('nc_1_n1z');
    const rect = slider.getBoundingClientRect();

    const { x, y, width, height } = rect;
    return {
      x: x + width/2,
      y: y + height/2,
    };
  });

  console.log({ x, y });

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 400, y);
  await page.mouse.up();

  await wait(5000);
}

let loginPage;

export async function login(skipSwitch = false) {
  const browser = await browserHandle;

  if(!loginPage)
    loginPage = await browser.newPage();

  let page = loginPage;

  if(!skipSwitch) {
    await page.goto('https://login.taobao.com/member/login.jhtml', { waitUntil: 'domcontentloaded' });
    await wait(2000);
  }

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  while(true) {
    const ready = await page.evaluate(() => {
      return document.getElementById('TPL_username_1');
    });

    if(ready) break;

    await wait(1000);
  }

  if(!skipSwitch)
    await page.evaluate(() => {
      const elem = document.querySelector('.login-switch > :last-child');
      elem.click();
    });

  await wait(1000);
  await page.evaluate((un, pass) => {
    document.getElementById('TPL_username_1').focus();
    document.getElementById('TPL_username_1').value = un;
    document.getElementById('TPL_password_1').focus();
    document.getElementById('TPL_password_1').value = pass;
  }, UNAME, PASSWORD);

  await wait(1000);

  await handleSlider(page);

  await page.evaluate(() => {
    document.querySelector('#J_Form button.J_Submit').click();
  });

  await wait(5000);

  const url = page.url();
  if(url.indexOf('https://login') === 0) return false;
  return true;
}

export async function query(kws, pn=1) {
  const browser = await browserHandle;
  const page = await browser.newPage();

  await page.goto(`https://2.taobao.com/list/list.htm?_input_charset=utf8&q=${kws}&page=${pn}`, { waitUntil: 'domcontentloaded' });
  await wait(2000);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  await wait(2000);

  await handleSlider(page);

  // Scroll
  while(true) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.evaluate(() => {
      window.scrollBy({ top: 1000000 }); // Scroll to bottom
    });
    await wait(5000);
    const newHeight = await page.evaluate(() => document.documentElement.scrollHeight);

    if(height === newHeight) break;
    console.log(`Height changed: ${height} -> ${newHeight}`);
  }

  const result = await page.evaluate(() => {
    const items = document.querySelectorAll('.item-info');
    const result = [];
    items.forEach(item => {
      const anchor = item.querySelector('.item-pic > a');
      const link = anchor.getAttribute('href');
      const title = anchor.getAttribute('title');

      const img = item.querySelector('.item-pic > a > img').getAttribute('src');
      const location = item.querySelector('.item-location').innerText;
      const brief = item.querySelector('.item-brief-desc').innerText;

      result.push({ link, title, img, location, brief });
    });
    return result;
  });

  await page.close();
  return result;
}
