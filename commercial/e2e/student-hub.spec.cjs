const {test,expect}=require('@playwright/test');
const {fixture,A,B,C,today}=require('./fixtures.cjs');
const fs=require('node:fs');const directory='.aura-integration/student-hub/after';fs.mkdirSync(directory,{recursive:true});
const url=section=>`/alunos/${C}?org=${A}&section=${section}`;
const context=page=>page.locator('.aura-student-context');
async function setup(page,section='overview'){
 const state=await fixture(page,{seedAppointments:2,seedObjectives:2,seedTimeline:18});
 await page.route('**/rest/v1/client_followups?*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([{goal:'Acompanhamento fictício de consistência',status:'active',responsible_id:state.second,next_review:today,revision:1}])}));
 await page.route('**/rest/v1/assessments?*',r=>{const data=[82,81,80,79].map((weight,i)=>{const day=new Date(today+'T12:00:00Z');day.setUTCDate(day.getUTCDate()-(3-i)*7);return {id:'synthetic-hub-'+i,assessed_on:day.toISOString().slice(0,10),weight_kg:weight,height_cm:175,waist_cm:94-i,revision:1,student_visible:false,superseded_at:null,source_system:'aura',source_revision:null};}).reverse();return r.fulfill({contentType:'application/json',headers:{'content-range':'0-3/4'},body:JSON.stringify(data)});});
 await page.goto(url(section));await expect(page.getByRole('heading',{name:'Aluno Fictício A',exact:true})).toBeVisible();await expect(context(page)).toHaveAttribute('aria-busy','false');return state;
}
for(const width of [375,1440])for(const section of ['overview','care','evolution','agenda','timeline'])test(`student hub ${section} ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await setup(page,section);
 if(section==='overview')await expect(page.getByRole('heading',{name:'Evolução recente',exact:true})).toBeVisible();
 if(section==='evolution')await expect(page.getByRole('img',{name:/4 medições/})).toBeVisible();
 if(section==='agenda')await expect(page.locator('.aura-appointment-list>li')).toHaveCount(2);
 if(section==='timeline')await expect(page.locator('.aura-timeline>li').first()).toBeVisible();
 if(width>900){await expect(context(page)).toContainText('Profissional Segundo');const body=await page.locator('.aura-student-body').boundingBox(),nav=await page.locator('.aura-student-navigation').boundingBox();expect(body.x).toBeGreaterThan(nav.x+nav.width);expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThan(3500);}
 else{await expect(page.getByRole('combobox',{name:'Área da ficha',exact:true})).toBeVisible();await expect(context(page).locator('summary')).toBeVisible();}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`${directory}/${section}-${width}.png`,fullPage:true});
});
for(const width of [320,1280])test(`student hub compact overview ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await setup(page);await expect(page.getByRole('img',{name:/4 medições/})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`${directory}/overview-${width}.png`,fullPage:true});
});
test('saved accompaniment refreshes the header without inventing a responsible or revision',async({page})=>{
 const state=await fixture(page);await page.goto(url('care'));await page.getByRole('textbox',{name:'Objetivo do acompanhamento',exact:true}).fill('Objetivo fictício guardado');await page.getByRole('combobox',{name:'Profissional responsável',exact:true}).selectOption(state.second);await page.getByLabel('Próxima revisão',{exact:true}).fill(today);await page.getByRole('button',{name:'Guardar acompanhamento',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Acompanhamento guardado'})).toBeVisible();await expect(context(page)).toContainText('Profissional Segundo');await expect(context(page).locator('time')).toHaveAttribute('datetime',today);
});
test('restricted access makes no header followup read and never exposes measurement controls',async({page})=>{
 await fixture(page,{restricted:true});let reads=0;await page.route('**/rest/v1/client_followups?*',r=>{reads++;return r.fallback();});await page.goto(url('overview'));await expect(page.getByText('Medições reservadas aos profissionais autorizados.')).toBeVisible();await expect(context(page)).toHaveCount(0);await expect(page.getByRole('heading',{name:'Evolução recente',exact:true})).toHaveCount(0);expect(reads).toBe(0);
});
test('header read failure is explicit and retry restores only authorized metadata',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await fixture(page);let fail=true;await page.route('**/rest/v1/client_followups?*',r=>fail?r.fulfill({status:400,contentType:'application/json',body:'{}'}):r.fallback());await page.goto(url('overview'));await expect(context(page).getByRole('status')).toContainText('Contexto indisponível ou sem acesso');await expect(context(page).locator('dd')).toHaveCount(0);await page.screenshot({path:`${directory}/context-error-1440.png`,fullPage:true});fail=false;await context(page).getByRole('button',{name:'Atualizar contexto'}).click();await expect(context(page)).toContainText('Sem acompanhamento registado');
});
test('mobile context disclosure is operable by keyboard without hiding section navigation',async({page})=>{
 await page.setViewportSize({width:375,height:900});await setup(page);const summary=context(page).locator('summary');await summary.focus();await page.keyboard.press('Enter');await expect(context(page).getByText('Profissional Segundo',{exact:true})).toBeVisible();await expect(summary).toBeFocused();await page.keyboard.press('Enter');await expect(context(page).getByText('Profissional Segundo',{exact:true})).toBeHidden();await page.getByRole('combobox',{name:'Área da ficha',exact:true}).selectOption('evolution');await expect(page.getByRole('heading',{name:'Evolução do aluno',exact:true})).toBeVisible();
});
test('delayed context from the prior organization cannot appear after switching',async({page})=>{
 await fixture(page);let release,started=false,delivered=false;const gate=new Promise(r=>release=r);
 await page.route('**/rest/v1/client_followups?*',async r=>{if(new URL(r.request().url()).searchParams.get('organization_id')!=='eq.'+A)return r.fallback();started=true;await gate;try{await r.fulfill({contentType:'application/json',body:JSON.stringify([{status:'active',responsible_id:null,next_review:'2091-06-15'}])});}finally{delivered=true;}});
 await page.goto(url('overview'));await expect.poll(()=>started).toBe(true);await page.getByRole('combobox',{name:/^Estabelecimento/}).selectOption(B);release();await expect.poll(()=>delivered).toBe(true);await expect(page.getByText('2091-06-15',{exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:'Aluno Fictício A',exact:true})).toHaveCount(0);
});
test('revocation while the header read is pending withholds its private context',async({page})=>{
 await fixture(page);let release,started=false,revoked=false;const gate=new Promise(r=>release=r);
 await page.route('**/rpc/aura_client_permissions',r=>revoked?r.fulfill({contentType:'application/json',body:JSON.stringify({assessments_read:true,followup_read:false,schedule_read:true})}):r.fallback());
 await page.route('**/rest/v1/client_followups?*',async r=>{started=true;await gate;await r.fulfill({contentType:'application/json',body:JSON.stringify([{status:'active',responsible_id:null,next_review:'2091-06-15'}])});});await page.goto(url('overview'));await expect.poll(()=>started).toBe(true);revoked=true;release();await expect(context(page).getByRole('status')).toContainText('Contexto indisponível ou sem acesso');await expect(page.getByText('2091-06-15',{exact:true})).toHaveCount(0);
});

test('empty student overview distinguishes absent measurements from a measured zero',async({page})=>{
 await page.setViewportSize({width:375,height:900});await fixture(page);await page.route('**/rest/v1/assessments?*',r=>r.fulfill({contentType:'application/json',headers:{'content-range':'*/0'},body:'[]'}));await page.goto(url('overview'));const overview=page.locator('.aura-student-overview');await expect(overview.getByText('Sem medição',{exact:true})).toHaveCount(3);await expect(overview.getByRole('img')).toHaveCount(0);await expect(overview.getByText('Regista avaliações para visualizar a evolução.',{exact:true})).toBeVisible();await page.screenshot({path:`${directory}/overview-empty-375.png`,fullPage:true});
});
