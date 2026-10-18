const {test,expect}=require('@playwright/test');
const {fixture,A,B,C}=require('./fixtures.cjs');
const profile=`/alunos/${C}?org=${A}&section=nutrition`;
async function open(page,options){await fixture(page,options);await page.goto(profile);await expect(page.getByRole('region',{name:'Nutrição de demonstração'})).toBeVisible();}
async function simulate(page){await page.getByRole('button',{name:'Composição',exact:true}).click();await page.getByText('Simular porção',{exact:true}).click();}
test('nutrition stays explicitly fictitious and makes no nutrition API requests',async({page})=>{
 const calls=[];page.on('request',r=>{if(/rest\/v1\/.*(nutrition|food|meal)/i.test(r.url()))calls.push(r.url());});
 await open(page);await expect(page.getByText('Sem persistência',{exact:true})).toBeVisible();await expect(page.getByText(/Este diário não pertence ao aluno/)).toBeVisible();
 await expect(page.getByText('0 conhecidos')).toHaveCount(0);await page.getByLabel('Dia de exemplo').selectOption('2026-10-14');await expect(page.getByText(/Não é possível concluir que o consumo foi zero/)).toBeVisible();expect(calls).toEqual([]);
});
test('diary and composition distinguish unknown values from known zero',async({page})=>{
 await open(page);await page.getByRole('button',{name:'Diário',exact:true}).click();await page.getByRole('button',{name:'Almoço 13:00',exact:true}).click();await expect(page.getByText('Preparação de exemplo',{exact:true})).toBeVisible();await expect(page.getByText('0 conhecidos · 1 item sem valor')).toHaveCount(2);
 await page.getByRole('button',{name:'Composição',exact:true}).click();await expect(page.getByText('0 g',{exact:true}).first()).toBeVisible();
});
test('portion simulation recomputes snapshots and invalid input cannot show old results',async({page})=>{
 await open(page);await simulate(page);const input=page.getByLabel('Quantidade de exemplo (g)');const result=page.locator('[aria-live=polite]');
 await input.fill('50');await expect(result).toContainText('50,5');await input.fill('100');await expect(result).toContainText('101');await input.fill('0');await expect(result.getByRole('alert')).toBeVisible();await expect(result.locator('.aura-nutrition-metric')).toHaveCount(0);
});
test('draft cancellation guards sections, organisation and reload; accepting exit resets simulation',async({page})=>{
 await open(page);await simulate(page);const input=page.getByLabel('Quantidade de exemplo (g)');await input.fill('75');
 page.on('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Resumo',exact:true}).click();await expect(input).toHaveValue('75');
 await page.getByRole('combobox',{name:/^Estabelecimento/}).selectOption(B);await expect(input).toHaveValue('75');await expect(page.getByRole('combobox',{name:/^Estabelecimento/})).toHaveValue(A);
 const reloadDialog=page.waitForEvent('dialog');const cdp=await page.context().newCDPSession(page);await cdp.send('Page.reload');await reloadDialog;await cdp.detach();await expect(input).toHaveValue('75');page.removeAllListeners('dialog');page.on('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Resumo',exact:true}).click();await expect(input).toHaveCount(0);await page.getByRole('button',{name:'Nutrição · demonstração',exact:true}).click();await simulate(page);await expect(input).toHaveValue('100');
});
test('simulation guards logout and route changes without persisting a draft',async({page})=>{
 await open(page);await simulate(page);const input=page.getByLabel('Quantidade de exemplo (g)');await input.fill('80');page.on('dialog',dialog=>dialog.dismiss());
 await page.getByRole('button',{name:'Terminar sessão',exact:true}).click();await expect(input).toHaveValue('80');
 await page.getByRole('link',{name:'Diretório de alunos',exact:true}).click();await expect(input).toHaveValue('80');
 page.removeAllListeners('dialog');page.on('dialog',dialog=>dialog.accept());await page.getByRole('link',{name:'Diretório de alunos',exact:true}).click();await expect(page).toHaveURL(/\/alunos\?org=/);await page.goto(profile);await simulate(page);await expect(input).toHaveValue('100');
});
test('restricted profile sees only invented nutrition, never receives measurement editing rights',async({page})=>{
 await open(page,{restricted:true});await expect(page.getByRole('button',{name:'Guardar avaliação'})).toHaveCount(0);await expect(page.getByText(/Dados inventados/)).toBeVisible();
});
test('nutrition cannot mount when profile permissions fail',async({page})=>{
 await fixture(page);await page.route('**/rpc/aura_client_permissions',route=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'42501',message:'Synthetic denial'})}));await page.goto(profile);await expect(page.getByRole('alert').filter({hasText:'Não foi possível verificar'})).toBeVisible();await expect(page.getByRole('region',{name:'Nutrição de demonstração'})).toHaveCount(0);
});
test('late organization A permissions cannot mount nutrition after switching to B',async({page})=>{
 await fixture(page);let release,started=false,settled=false;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/rpc/aura_client_permissions',async route=>{if(route.request().postDataJSON().p_org!==A)return route.fallback();started=true;await gate;await route.fallback();settled=true;});
 await page.goto(profile);await expect.poll(()=>started).toBe(true);await page.getByRole('combobox',{name:/^Estabelecimento/}).selectOption(B);release();await expect.poll(()=>settled).toBe(true);
 await expect(page.getByRole('combobox',{name:/^Estabelecimento/})).toHaveValue(B);await expect(page.getByRole('region',{name:'Nutrição de demonstração'})).toHaveCount(0);await expect(page.getByRole('heading',{name:'Aluno Fictício A',exact:true})).toHaveCount(0);
});
for(const [name,width,height] of [['desktop',1440,1000],['mobile',320,850]])test(`nutrition keyboard and visual evidence ${name}`,async({page})=>{
 await page.setViewportSize({width,height});await open(page);await page.screenshot({path:`.aura-integration/nutrition-p1-p2/visual/${name}-summary.png`,fullPage:true});
 await page.getByRole('button',{name:'Diário',exact:true}).click();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`.aura-integration/nutrition-p1-p2/visual/${name}-diary.png`,fullPage:true});
 await page.getByRole('button',{name:'Composição',exact:true}).click();const disclosure=page.locator('summary').filter({hasText:'Simular porção'});await disclosure.focus();await expect(disclosure).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByLabel('Quantidade de exemplo (g)')).toBeVisible();
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`.aura-integration/nutrition-p1-p2/visual/${name}-composition.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
