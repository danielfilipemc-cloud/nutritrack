const {test,expect}=require('@playwright/test');
const {fixture,A,B,C,today}=require('./fixtures.cjs');
const fs=require('node:fs');const directory='.aura-integration/daily-dashboard/after';fs.mkdirSync(directory,{recursive:true});
const chart=page=>page.getByRole('region',{name:'Evolução individual na dashboard',exact:true});
const isSeries=route=>new URL(route.request().url()).searchParams.get('select')==='id,assessed_on,weight_kg,height_cm,waist_cm,superseded_at';
function rows(referenceDate=today){return [82,81,80,79].map((weight,i)=>{const date=new Date(referenceDate+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-(3-i)*7);return {id:'synthetic-day-'+i,assessed_on:date.toISOString().slice(0,10),weight_kg:weight,height_cm:175,waist_cm:90-i,superseded_at:null};}).reverse();}
async function rich(page,referenceDate=today){await fixture(page,{seedAppointments:3,seedObjectives:2,referenceDate});await page.route('**/rest/v1/assessments?*',route=>isSeries(route)?route.fulfill({contentType:'application/json',body:JSON.stringify(rows(referenceDate))}):route.fallback());await page.goto('/');await expect(chart(page).getByRole('img',{name:/Evolução: 4 medições/})).toBeVisible();}
for(const width of [320,375,1280,1440,1536])test(`daily dashboard reference layout ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.clock.install({time:new Date('2026-10-20T12:00:00Z')});await rich(page,'2026-10-20');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.locator('.stat>div')).toHaveCount(4);await expect(page.getByRole('region',{name:'Alunos que precisam de atenção'})).toBeVisible();
 const schedule=page.getByRole('region',{name:'Agenda de hoje',exact:true});await expect(schedule.locator('time').first()).toContainText('10:00');
 if(width>1000)expect((await schedule.boundingBox()).x).toBeGreaterThan((await chart(page).boundingBox()).x);
 await chart(page).getByRole('combobox',{name:'Indicador da dashboard',exact:true}).selectOption('waist_cm');await expect(chart(page).getByRole('img',{name:/de 90 a 87 cm/})).toBeVisible();await chart(page).getByRole('combobox',{name:'Indicador da dashboard',exact:true}).selectOption('weight_kg');
 await page.screenshot({path:`${directory}/dashboard-${width}.png`,fullPage:true});
});
for(const kind of ['denied','error'])test(`dashboard measurements stay hidden when access is ${kind}`,async({page})=>{
 await fixture(page);await expect(chart(page).getByRole('img')).toBeVisible();let reads=0;await page.route('**/rpc/aura_client_permissions',r=>r.fulfill({status:kind==='error'?500:200,contentType:'application/json',body:JSON.stringify({assessments_read:false})}));await page.route('**/rest/v1/assessments?*',r=>{if(isSeries(r))reads++;return r.fallback();});await page.goto('/');
 await expect(chart(page).getByText(/Evolução indisponível ou sem permissão/)).toBeVisible();await expect(chart(page).getByRole('img')).toHaveCount(0);expect(reads).toBe(0);
});
test('revocation while dashboard measurements load discards the response',async({page})=>{
 await fixture(page);let revoked=false,release,started=false;const gate=new Promise(r=>release=r);
 await page.route('**/rpc/aura_client_permissions',r=>revoked?r.fulfill({contentType:'application/json',body:JSON.stringify({assessments_read:false})}):r.fallback());
 await page.route('**/rest/v1/assessments?*',async r=>{if(!isSeries(r))return r.fallback();started=true;await gate;await r.fulfill({contentType:'application/json',body:JSON.stringify(rows())});});await page.goto('/');await expect.poll(()=>started).toBe(true);revoked=true;release();await expect(chart(page).getByText(/Evolução indisponível ou sem permissão/)).toBeVisible();await expect(chart(page).getByRole('img')).toHaveCount(0);
});
test('late dashboard measurement response from organization A cannot populate B',async({page})=>{
 await fixture(page);await expect(chart(page).getByRole('img')).toBeVisible();let release,started=false,delivered=false;const gate=new Promise(r=>release=r);
 await page.route('**/rest/v1/assessments?*',async r=>{if(!isSeries(r)||new URL(r.request().url()).searchParams.get('organization_id')!=='eq.'+A)return r.fallback();started=true;await gate;try{await r.fulfill({contentType:'application/json',body:JSON.stringify(rows())});}finally{delivered=true;}});await chart(page).getByRole('button',{name:'Atualizar gráfico'}).click();await expect.poll(()=>started).toBe(true);
 await page.getByRole('combobox',{name:/^Estabelecimento/}).selectOption(B);await expect(page.locator('.brandhead')).toContainText('Marca B');release();await expect.poll(()=>delivered).toBe(true);
 await expect(chart(page).getByRole('img',{name:/de 82 a 79/})).toHaveCount(0);await expect(page.getByText('Aluno Fictício A',{exact:true})).toHaveCount(0);
});
test('failed graph refresh clears previously displayed measurements and retries safely',async({page})=>{
 await rich(page);let fail=true;await page.route('**/rest/v1/assessments?*',r=>isSeries(r)&&fail?r.abort('failed'):r.fallback());await chart(page).getByRole('button',{name:'Atualizar gráfico'}).click();await expect(chart(page).getByRole('img')).toHaveCount(0);await expect(chart(page).getByText(/Evolução indisponível ou sem permissão/)).toBeVisible({timeout:12000});fail=false;await chart(page).getByRole('button',{name:'Atualizar gráfico'}).click();await expect(chart(page).getByRole('img',{name:/4 medições/})).toBeVisible();
});
test('dashboard preview reports its cap rather than claiming the complete history',async({page})=>{
 await fixture(page);await page.route('**/rest/v1/assessments?*',r=>{if(!isSeries(r))return r.fallback();return r.fulfill({contentType:'application/json',body:JSON.stringify(Array.from({length:201},(_,i)=>({...rows()[0],id:'synthetic-cap-'+i})))});});await page.goto('/');await expect(chart(page).getByText('Pré-visualização limitada a 200 avaliações; consulta a ficha para continuar.',{exact:false})).toBeVisible();await expect(chart(page).getByRole('link',{name:'Abrir evolução na ficha',exact:true})).toHaveAttribute('href',`/alunos/${C}?org=${A}&section=evolution`);
});

test('detailed priorities open by keyboard and retain their search draft when collapsed',async({page})=>{
 await fixture(page);const details=page.locator('.aura-home-priorities'),summary=details.locator(':scope>summary');await summary.focus();await page.keyboard.press('Enter');const field=details.getByRole('textbox',{name:'Pesquisar aluno nas prioridades',exact:true});await field.fill('Pesquisa fictícia');await summary.focus();await page.keyboard.press('Enter');await expect(field).toBeHidden();await page.keyboard.press('Enter');await expect(field).toHaveValue('Pesquisa fictícia');
});

// Fixed UTC fixtures must render in the establishment's civil time across DST.
for(const [date,expected] of [['2026-10-24','10:00'],['2026-10-25','09:00']])test(`dashboard agenda uses Lisbon time on ${date}`,async({page})=>{
 await page.clock.install({time:new Date(date+'T12:00:00Z')});await fixture(page,{referenceDate:date,seedAppointments:1});
 await expect(page.getByRole('region',{name:'Agenda de hoje',exact:true}).locator('time').first()).toHaveText(expected);
});
