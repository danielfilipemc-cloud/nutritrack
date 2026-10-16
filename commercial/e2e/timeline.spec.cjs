const {test,expect}=require('@playwright/test');
const {fixture,A,B,C}=require('./fixtures.cjs');
test('integrated evolution preserves charts, loads history pages and filters measurement provenance',async({page})=>{
 await fixture(page,{seedTimeline:30});await page.goto(`/alunos/${C}?org=${A}&section=evolution`);
 await expect(page.getByRole('heading',{name:'Evolução do aluno'})).toBeVisible();const timeline=page.getByRole('region',{name:'Cronologia integrada do aluno'});
 await expect(timeline.locator('.aura-timeline>li')).toHaveCount(25);await timeline.getByRole('button',{name:'Carregar mais registos'}).click();await expect(timeline.locator('.aura-timeline>li')).toHaveCount(31);
 await timeline.getByLabel('Tipo de registo').selectOption('assessment');await expect(timeline.locator('.aura-timeline>li')).toHaveCount(1);await expect(timeline.getByText('80 kg',{exact:true})).toBeVisible();await expect(timeline.getByText(/Origem: AURA/)).toBeVisible();await expect(timeline.getByRole('link',{name:'Abrir avaliações'})).toHaveAttribute('href',`/alunos/${C}?org=${A}&section=assessments`);
 await timeline.getByLabel('Período da cronologia').selectOption('0');await expect(timeline.locator('.aura-timeline>li')).toHaveCount(1);await expect(page.getByLabel('Período da evolução')).toHaveValue('0');
 await page.getByLabel('Período da evolução').selectOption('30');await expect(timeline.getByLabel('Período da cronologia')).toHaveValue('30');
});
test('failed additional timeline page remains explicitly incomplete and can retry without duplicates',async({page})=>{
 await fixture(page,{seedTimeline:30});await page.goto(`/alunos/${C}?org=${A}&section=timeline`);const timeline=page.getByRole('region',{name:'Cronologia integrada do aluno'});await expect(timeline.locator('.aura-timeline>li')).toHaveCount(25);
 let fail=true;await page.route('**/rpc/aura_client_timeline',route=>{if(fail&&route.request().postDataJSON().p_before){fail=false;return route.fulfill({status:500,contentType:'application/json',body:'{}'});}return route.fallback();});
 await timeline.getByRole('button',{name:'Carregar mais registos'}).click();await expect(timeline.getByRole('alert')).toContainText('incompleta');await expect(timeline.locator('.aura-timeline>li')).toHaveCount(25);await timeline.getByRole('button',{name:'Carregar mais registos'}).click();await expect(timeline.locator('.aura-timeline>li')).toHaveCount(31);await expect(timeline.getByRole('alert')).toHaveCount(0);
});
test('commercial-only timeline has no sensitive records and supports mobile and organization switching',async({page})=>{
 await page.setViewportSize({width:375,height:812});await fixture(page,{restricted:true,seedTimeline:30});await page.goto(`/alunos/${C}?org=${A}&section=timeline`);const timeline=page.getByRole('region',{name:'Cronologia integrada do aluno'});await expect(timeline.getByText('Sem registos neste período')).toBeVisible();await expect(timeline.getByText(/80 kg/)).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 await page.getByRole('combobox',{name:/^Estabelecimento/}).selectOption(B);await expect(timeline).toHaveCount(0);await expect(page.getByRole('status')).toContainText('Aluno indisponível');
});
test('revocation clears already loaded timeline records rather than retaining sensitive pages',async({page})=>{
 await fixture(page,{seedTimeline:30});await page.goto(`/alunos/${C}?org=${A}&section=timeline`);const timeline=page.getByRole('region',{name:'Cronologia integrada do aluno'});await expect(timeline.locator('.aura-timeline>li')).toHaveCount(25);
 await page.route('**/rpc/aura_client_timeline',route=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'42501',message:'Denied'})}));await timeline.getByRole('button',{name:'Carregar mais registos'}).click();await expect(timeline.getByRole('alert')).toBeVisible();await expect(timeline.locator('.aura-timeline>li')).toHaveCount(0);
});
test('partial competency revocation clears previous timeline pages even while the profile remains accessible',async({page})=>{
 await fixture(page,{seedTimeline:30});await page.goto(`/alunos/${C}?org=${A}&section=timeline`);const timeline=page.getByRole('region',{name:'Cronologia integrada do aluno'});await expect(timeline.locator('.aura-timeline>li')).toHaveCount(25);
 await page.route('**/rpc/aura_client_permissions',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({assessments_read:true,followup_read:false,schedule_read:true})}));
 await timeline.getByRole('button',{name:'Carregar mais registos'}).click();await expect(timeline.getByRole('alert')).toContainText('acessos mudaram');await expect(timeline.locator('.aura-timeline>li')).toHaveCount(0);
});
