import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const l of readFileSync('.env.local','utf8').split('\n')) {
  const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if(m) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'');
}
const URL_=process.env.NEXT_PUBLIC_SUPABASE_URL, ANON=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ref=new URL(URL_).hostname.split('.')[0];
const svc=createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const { data:link } = await svc.auth.admin.generateLink({ type:'magiclink', email:'x@jonathanpinto.net' });
const u=createClient(URL_,ANON,{auth:{persistSession:false}});
const { data:sess } = await u.auth.verifyOtp({ token_hash:link.properties.hashed_token, type:'email' });
const cookie='base64-'+Buffer.from(JSON.stringify(sess.session)).toString('base64url');

const b=await chromium.launch({args:['--no-sandbox']});
const ctx=await b.newContext({viewport:{width:1400,height:950}});
await ctx.addCookies([{name:`sb-${ref}-auth-token`,value:cookie,domain:'localhost',path:'/',sameSite:'Lax'}]);
const p=await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,160)));

// public panels
await p.goto('http://localhost:3000',{waitUntil:'domcontentloaded',timeout:180000});
await p.waitForSelector('canvas',{timeout:120000});
await p.waitForTimeout(28000);
for (const s of ['live','contact']) {
  await p.locator(`nav button:has-text("${s}")`).first().click();
  await p.waitForTimeout(2500);
  await p.screenshot({ path:`qa-p3-${s}.png` });
  await p.keyboard.press('Escape');
  await p.waitForTimeout(1200);
}

// admin screens
for (const [path,name] of [['/admin/live','live'],['/admin/settings','settings']]) {
  await p.goto('http://localhost:3000'+path,{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(2500);
  console.log(name,'->',p.url(), p.url().includes('login')?'*** REDIRECTED ***':'ok');
  await p.screenshot({ path:`qa-p3-admin-${name}.png` });
}
console.log('errors:', JSON.stringify(errs.slice(0,4)));
await b.close();
