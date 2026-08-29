import { chromium, devices } from 'playwright';
const b = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ...devices['iPhone 14'] });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0,200)));
await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 240000 });
await p.waitForSelector('canvas', { timeout: 240000 });
await p.waitForTimeout(25000);

// Count distinct canvas frames over ~2s -> is it still moving, and how much?
const motion = async (label) => {
  const shots = [];
  for (let i = 0; i < 6; i++) {
    shots.push((await p.locator('canvas').screenshot()).toString('base64'));
    await p.waitForTimeout(330);
  }
  const distinct = new Set(shots).size;
  console.log(`${label.padEnd(16)} ${distinct}/6 distinct frames -> ${distinct > 1 ? 'ANIMATING' : 'STATIC'}`);
};
await motion('idle');
await p.locator('nav button:has-text("catalog")').first().click();
await p.waitForTimeout(2000);
await motion('panel open');
await p.keyboard.press('Escape');
await p.waitForTimeout(1800);
await motion('after close');
console.log(errs.length ? 'ERR ' + errs.join('|') : 'no page errors');
await b.close();
