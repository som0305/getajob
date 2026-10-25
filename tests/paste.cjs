// Run with Playwright installed: node tests/paste.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
 const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
 const page = await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Loading the exact HTML without a server proves extraction requires no API.
 await page.route('https://getajob.test/**', route=>route.fulfill(route.request().url().endsWith('assets/rabbit-butler-game.png')?{contentType:'image/png',body:fs.readFileSync(require('node:path').join(__dirname,'../assets/rabbit-butler-game.png'))}:{contentType:'text/html',body:fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8')}));
 await page.goto('https://getajob.test/');
 await page.click('#organizePosting');assert((await page.locator('#pasteError').textContent()).includes('붙여넣어'));
 await page.evaluate(()=>{document.querySelector('#jobEditor').showModal=undefined});
 const parsed=await page.evaluate(()=>parsePosting('회사명: 샘플회사\n모집 직무: 서비스 기획자\n접수 기간: 2026.10.01 ~ 2026.10.31\n1차 면접: 2026년 11월 5일\n2차 면접: 11/12\n합격 발표: 추후 안내'));
 assert.equal(parsed.company,'샘플회사');assert.equal(parsed.title,'서비스 기획자');assert.equal(parsed.schedules[0].date,'2026-10-31');assert.equal(parsed.schedules[1].date,'2026-11-05');assert.equal(parsed.schedules[2].date,'');assert.equal(parsed.schedules[3].date,'');
 const invalid=await page.evaluate(()=>parsePosting('서류 마감: 2026.02.30'));assert.equal(invalid.schedules[0].date,'');
 await page.fill('#postingText','회사명: 샘플회사\n직무: 서비스 기획자\n접수기간: 2026.10.01 ~ 2026.10.31\n1차 면접: 2026년 11월 5일\n최종 발표: 추후 안내');await page.click('#pasteForm button');
 assert.equal(await page.locator('#jobEditor').isVisible(),true);assert((await page.locator('#pasteError').textContent()).includes('확인'));assert.equal(await page.inputValue('#company'),'샘플회사');assert.equal(await page.locator('.schedule-row').count(),3);
 assert.equal(await page.locator('.schedule-row input[type=checkbox]').nth(2).isChecked(),false);
 await page.locator('#savePosting').click();
 assert.equal(await page.locator('#jobs .job').count(),1);let state=await page.evaluate(()=>JSON.parse(localStorage.getItem('getajob-modern-v1')));assert.equal(state.jobs[0].stage,'고민중');assert.equal(Object.values(state.events).flat().length,2);
 await page.reload();assert.equal(await page.locator('#jobs .job').count(),1);
 await page.fill('#postingText','날짜 없는 공고');await page.click('#pasteForm button');await page.fill('#company','날짜없음');await page.fill('#jobTitle','개발자');await page.locator('#savePosting').click();state=await page.evaluate(()=>JSON.parse(localStorage.getItem('getajob-modern-v1')));assert.equal(state.jobs.length,2);assert.equal(Object.values(state.events).flat().length,2);
 await page.locator('.day').nth(5).click();await page.fill('#eventTitle','직접 작성');await page.click('#saveEvent');assert.equal(await page.locator('.event').filter({hasText:'직접 작성'}).count(),1);
 await page.getByRole('button',{name:'노랑 형광펜',exact:true}).click();const r=await page.locator('#ink').boundingBox();async function stroke(a,b,c,d){await page.mouse.move(r.x+a,r.y+b);await page.mouse.down();await page.mouse.move(r.x+c,r.y+d,{steps:8});await page.mouse.up()}await stroke(30,80,200,80);await page.click('#eraser');await stroke(100,60,100,100);assert.equal(await page.locator('#ink mask').count(),1);await page.click('#undo');assert.equal(await page.locator('#ink mask').count(),0);
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 // Regression: HTTP lacks crypto.randomUUID. Save must still work, with visible validation.
 const httpPage=await browser.newPage();httpPage.on('pageerror',e=>errors.push(e.message));
 await httpPage.route('http://getajob.test/**',route=>route.fulfill(route.request().url().endsWith('assets/rabbit-butler-game.png')?{contentType:'image/png',body:fs.readFileSync(require('node:path').join(__dirname,'../assets/rabbit-butler-game.png'))}:{contentType:'text/html',body:fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8')}));
 await httpPage.goto('http://getajob.test');assert.equal(await httpPage.evaluate(()=>typeof crypto.randomUUID),'undefined');
 await httpPage.fill('#postingText','서류 마감: 2026.11.20');await httpPage.click('#organizePosting');await httpPage.click('#savePosting');assert((await httpPage.locator('#reviewError').textContent()).includes('회사명'));assert.equal(await httpPage.locator('#company').getAttribute('aria-invalid'),'true');
 await httpPage.fill('#company','HTTP 회사');await httpPage.click('#savePosting');assert((await httpPage.locator('#reviewError').textContent()).includes('직무'));await httpPage.fill('#jobTitle','기획');
 await httpPage.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError')}});await httpPage.click('#savePosting');assert((await httpPage.locator('#reviewError').textContent()).includes('저장 권한'));assert.equal(await httpPage.locator('#savePosting').isEnabled(),true);assert.equal(await httpPage.evaluate(()=>state.jobs.length),0);
 await httpPage.evaluate(()=>{Storage.prototype.setItem=window.originalSetItem});await httpPage.click('#savePosting');assert.equal(await httpPage.locator('#jobs .job').count(),1);assert.equal(await httpPage.locator('.event').count(),1);await httpPage.reload();assert.equal(await httpPage.locator('#jobs .job').count(),1);assert.deepEqual(errors,[]);await httpPage.close();
 console.log('PASS: HTTP UUID fallback, visible missing-field errors, storage failure rollback, retry and persisted job/calendar.');
 console.log('PASS: text extraction, valid dates/ranges, unknown-year and invalid-date handling, editable review, drawer + calendar save, undated jobs, persistence, manual event, eraser, mobile.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
