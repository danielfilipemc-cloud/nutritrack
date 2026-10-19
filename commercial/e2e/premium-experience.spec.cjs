const {test,expect}=require('@playwright/test');
const {fixture,A,C}=require('./fixtures.cjs');
const fs=require('node:fs');
const directory='.aura-integration/premium-experience/after';
fs.mkdirSync(directory,{recursive:true});
const luminance=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(n=>Number(n)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
const ratio=(a,b)=>{const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (values[0]+.05)/(values[1]+.05);};
async function login(page){await page.route(/^https:\/\/[^/]+\.supabase\.co\//,r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));await page.goto('/');await expect(page.getByRole('button',{name:'Entrar na plataforma',exact:true})).toBeEnabled();}
for(const width of [320,375,768,1440])test(`premium login composition and accessible controls ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:width===1440?1000:900});await login(page);
 await expect(page.getByRole('heading',{level:1})).toHaveCount(1);await expect(page.getByRole('img',{name:'AURA Business',exact:true})).toHaveJSProperty('naturalWidth',390);
 const story=page.locator('.aura-entry-story'),access=page.locator('.aura-entry-access');
 if(width>800){const s=await story.boundingBox(),a=await access.boundingBox();expect(a.x).toBeGreaterThan(s.x+s.width);await expect(page.locator('.aura-entry-art')).toBeVisible();}
 else{await expect(page.locator('.aura-entry-art')).toBeHidden();expect((await access.boundingBox()).y).toBeGreaterThan((await story.boundingBox()).y);}
 for(const field of [page.getByLabel('Email',{exact:true}),page.getByLabel('Palavra-passe',{exact:true}),page.getByRole('button',{name:'Entrar na plataforma',exact:true})])expect((await field.boundingBox()).height).toBeGreaterThanOrEqual(44);
 const inputContrast=await page.getByLabel('Email',{exact:true}).evaluate(el=>({fg:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));expect(ratio(inputContrast.fg,inputContrast.bg)).toBeGreaterThanOrEqual(4.5);
 const buttonContrast=await page.getByRole('button',{name:'Entrar na plataforma',exact:true}).evaluate(el=>({fg:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));expect(ratio(buttonContrast.fg,buttonContrast.bg)).toBeGreaterThanOrEqual(4.5);
 await page.getByLabel('Email',{exact:true}).focus();await page.keyboard.press('Tab');await expect(page.getByLabel('Palavra-passe',{exact:true})).toBeFocused();await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Entrar na plataforma',exact:true})).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.aura-entry-art img').evaluate(img=>img.decode());await page.evaluate(()=>{document.activeElement.blur();window.scrollTo(0,0)});await page.screenshot({path:`${directory}/login-${width}.png`,fullPage:true});
});
test('premium login retains busy, failure feedback and the existing real destinations',async({page})=>{
 await login(page);let release,started=false;const gate=new Promise(r=>release=r);
 await page.route(/\/auth\/v1\/token\?grant_type=password/,async route=>{started=true;await gate;await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'invalid_credentials',message:'Synthetic denial'})});});
 await page.getByLabel('Email',{exact:true}).fill('fictional@example.invalid');await page.getByLabel('Palavra-passe',{exact:true}).fill('FictitiousOnly!234');await page.getByRole('button',{name:'Entrar na plataforma',exact:true}).click();await expect.poll(()=>started).toBe(true);
 await expect(page.getByRole('button',{name:'Entrar na plataforma',exact:true})).toBeDisabled();await expect(page.locator('form')).toHaveAttribute('aria-busy','true');release();
 await expect(page.getByRole('status')).toContainText('Credenciais inválidas ou acesso indisponível.');await expect(page.getByLabel('Palavra-passe',{exact:true})).toHaveValue('');await expect(page.getByLabel('Email',{exact:true})).toHaveValue('fictional@example.invalid');
 await expect(page.getByRole('link',{name:/Explorar demonstração/})).toHaveAttribute('href','/demo');await expect(page.getByRole('link',{name:'Acede à tua área',exact:true})).toHaveAttribute('href','/aluno');
});
test('compact mobile navigation keeps eight real modules keyboard reachable',async({page})=>{
 await page.setViewportSize({width:320,height:812});await fixture(page);await page.goto('/');
 const summary=page.getByText('Menu principal',{exact:true});await summary.focus();await page.keyboard.press('Enter');
 const nav=page.getByRole('navigation',{name:'Navegação principal',exact:true});await expect(nav.getByRole('link')).toHaveCount(8);await expect(nav.locator('svg')).toHaveCount(8);
 await page.getByRole('link',{name:'Alunos',exact:true}).click();await expect(page).toHaveURL(/\/alunos$/);await expect(summary).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
for(const width of [375,1440])for(const [name,url] of [['team','/equipa'],['settings','/definicoes'],['timeline',`/alunos/${C}?org=${A}&section=timeline`]])test(`premium shared module ${name} ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await fixture(page,{seedAppointments:2,seedTimeline:16});await page.goto(url);await expect(page.getByRole('heading',{level:1})).toBeVisible();await expect(page.getByRole('img',{name:'AURA Business',exact:true})).toHaveJSProperty('naturalWidth',390);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${directory}/${name}-${width}.png`,fullPage:true});
});
test('reduced motion keeps the decorative environment static and focus visible',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await login(page);await page.getByLabel('Email',{exact:true}).focus();
 const style=await page.getByLabel('Email',{exact:true}).evaluate(el=>({outline:getComputedStyle(el).outlineStyle,width:getComputedStyle(el).outlineWidth}));expect(style.outline).toBe('solid');expect(parseFloat(style.width)).toBeGreaterThanOrEqual(2);
 const animated=await page.locator('.aura-entry').evaluate(el=>[...el.querySelectorAll('*')].some(node=>getComputedStyle(node).animationName!=='none'));expect(animated).toBe(false);
});
test('branding read failure remains usable and bounded in the compact desktop heading',async({page})=>{
 await page.setViewportSize({width:1024,height:900});await fixture(page);let failed=false;
 await page.route('**/rest/v1/organization_branding?*',route=>{if(!failed){failed=true;return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'Synthetic brand read failure'})});}return route.fallback();});
 await page.goto('/');const retry=page.getByRole('button',{name:'Tentar carregar marca',exact:true});await expect(retry).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await retry.click();await expect(page.locator('.brandhead')).toContainText('Marca A');await expect(retry).toHaveCount(0);
});
test('premium chart shades the actual series and preserves all four values in its accessible table',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await fixture(page,{readOnly:true});
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon'}).format(new Date());
 const records=[82,81,80,79].map((value,i)=>{const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-(3-i)*7);return {id:'synthetic-premium-'+i,assessed_on:date.toISOString().slice(0,10),weight_kg:value,height_cm:null,waist_cm:null,superseded_at:null};});
 await page.route('**/rest/v1/assessments?*',route=>{const url=new URL(route.request().url());if(url.searchParams.get('select')!=='id,assessed_on,weight_kg,height_cm,waist_cm,superseded_at')return route.fallback();return route.fulfill({contentType:'application/json',body:JSON.stringify([...records].reverse())});});
 await page.goto(`/alunos/${C}?org=${A}&section=evolution`);const chart=page.getByRole('img',{name:'Evolução: 4 medições, de 82 a 79 kg',exact:true});await expect(chart).toBeVisible();await expect(chart.locator('circle')).toHaveCount(4);
 const line=await chart.locator('polyline').getAttribute('points'),area=await chart.locator('polygon').getAttribute('points');expect(area).toContain(line);await expect(chart.locator('polygon')).toHaveAttribute('aria-hidden','true');
 await page.getByText('Consultar medições em tabela',{exact:true}).click();for(const value of records)await expect(page.getByRole('table').getByRole('cell',{name:String(value.weight_kg),exact:true})).toBeVisible();
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${directory}/evolution-series-1440.png`,fullPage:true});
});
