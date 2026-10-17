const {test,expect}=require('@playwright/test');
const {fixture,A,B,C}=require('./fixtures.cjs');
test('daily queue paginates objectives, searches literally and opens the right profile section',async({page})=>{
 await fixture(page,{seedObjectives:28});const queue=page.getByRole('region',{name:'Prioridades do profissional'});
 await queue.getByLabel('Tipo de prioridade').selectOption('objective');await expect(queue.locator('.aura-priority-list>li')).toHaveCount(25);
 await queue.getByRole('button',{name:'Seguintes',exact:true}).click();await expect(queue.locator('.aura-priority-list>li')).toHaveCount(3);
 await queue.getByRole('link',{name:/Ver objetivos/}).first().click();await expect(page).toHaveURL(new RegExp(`/alunos/${C}.*section=objectives`));await expect(page.getByRole('heading',{name:'Objetivos de acompanhamento'})).toBeVisible();
 await page.goto('/');await queue.getByLabel('Pesquisar aluno nas prioridades').fill('%');await queue.getByRole('button',{name:'Pesquisar prioridades'}).click();await expect(queue.getByText('Sem prioridades neste filtro')).toBeVisible();
});
test('daily queue discards late tenant responses and hides unauthorized followup',async({page})=>{
 await fixture(page,{seedObjectives:3,slowA:true});await page.getByRole('combobox',{name:/^Estabelecimento/}).selectOption(B);
 const queue=page.getByRole('region',{name:'Prioridades do profissional'});await expect(queue.getByText('Sem prioridades neste filtro')).toBeVisible();await page.waitForTimeout(800);await expect(queue.getByText(/Objetivo fictício/)).toHaveCount(0);
});
test('daily queue retries failures and remains usable on mobile',async({page})=>{
 await page.setViewportSize({width:375,height:812});await fixture(page,{restricted:true,seedObjectives:3});let fail=true;
 await page.route('**/rpc/aura_daily_priorities',route=>{if(fail)return route.fulfill({status:500,contentType:'application/json',body:'{}'});return route.fallback();});
 await page.goto('/');const queue=page.getByRole('region',{name:'Prioridades do profissional'});await expect(queue.getByRole('alert')).toBeVisible();fail=false;await queue.getByRole('button',{name:'Atualizar prioridades'}).click();await expect(queue.getByText('Sem prioridades neste filtro')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 await page.goto(`/alunos/${C}?org=${A}&section=objectives`);await expect(page.getByRole('heading',{name:'Objetivos de acompanhamento'})).toHaveCount(0);
});

test('dashboard network failure preserves daily operations and retries the indicators',async({page})=>{
 await fixture(page,{seedObjectives:2});let fail=true;
 await page.route('**/rpc/aura_care_dashboard',r=>fail?r.abort('failed'):r.fallback());await page.goto('/');
 await expect(page.getByRole('alert').filter({hasText:'Não foi possível carregar o painel'})).toBeVisible();
 const queue=page.getByRole('region',{name:'Prioridades do profissional'});await expect(queue.getByRole('link',{name:/Ver objetivos/})).toHaveCount(2);
 fail=false;await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();await expect(page.getByLabel('Indicadores do estabelecimento')).toBeVisible();
});

test('daily shortcuts preserve selected organization and counters open their existing module',async({page})=>{
 await fixture(page,{seedObjectives:2});const queue=page.getByRole('region',{name:'Prioridades do profissional'});
 await queue.getByRole('button',{name:'Objetivos até hoje: 2',exact:true}).click();await expect(queue.getByLabel('Tipo de prioridade')).toHaveValue('objective');
 await page.getByRole('combobox',{name:/^Estabelecimento/}).selectOption(B);
 const shortcuts=page.getByRole('navigation',{name:'Operações frequentes'});
 for(const [name,path] of [['Registar ou gerir aluno','/alunos'],['Registar avaliação','/avaliacoes'],['Abrir agenda','/agenda'],['Gerir equipa','/equipa'],['Personalizar marca','/marca']])await expect(shortcuts.getByRole('link',{name,exact:true})).toHaveAttribute('href',path+'?org='+B);
 await shortcuts.getByRole('link',{name:'Abrir agenda',exact:true}).click();await expect(page.getByRole('combobox',{name:/^Estabelecimento/})).toHaveValue(B);
});

test('coach daily shortcuts omit management actions while leaving authorized workflow available',async({page})=>{
 await fixture(page,{role:'coach'});const shortcuts=page.getByRole('navigation',{name:'Operações frequentes'});
 await expect(shortcuts.getByRole('link',{name:'Gerir equipa'})).toHaveCount(0);await expect(shortcuts.getByRole('link',{name:'Personalizar marca'})).toHaveCount(0);
 await expect(shortcuts.getByRole('link',{name:'Registar avaliação'})).toBeVisible();
});
