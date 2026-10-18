const {test,expect}=require('@playwright/test');
const {fixture,A,C}=require('./fixtures.cjs');
test('desktop navigation exposes eight modules and a single establishment selector',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await fixture(page);
 const nav=page.getByRole('navigation',{name:'Navegação principal',exact:true});await expect(nav.getByRole('link')).toHaveCount(8);
 await expect(page.getByRole('combobox',{name:/^Estabelecimento/})).toHaveCount(1);
 await nav.getByRole('link',{name:'Definições',exact:true}).click();await expect(page.getByRole('heading',{name:'Definições',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Gerir competências',exact:true})).toHaveAttribute('href','/acessos?org='+A);
 await nav.getByRole('link',{name:'Evolução',exact:true}).click();await expect(page.getByRole('heading',{name:'Evolução',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Guardar avaliação',exact:true})).toHaveCount(0);
});
test('mobile navigation is a keyboard disclosure without a cramped bottom bar',async({page})=>{
 await page.setViewportSize({width:375,height:812});await fixture(page);const menu=page.locator('.aura-nav-disclosure>summary');const nav=page.getByRole('navigation',{name:'Navegação principal',exact:true});
 await expect(nav).toBeHidden();await menu.focus();await page.keyboard.press('Enter');await expect(nav).toBeVisible();await nav.getByRole('link',{name:'Alunos',exact:true}).click();await expect(page.getByRole('heading',{name:'Os teus alunos.',exact:true})).toBeVisible();await expect(nav).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);await page.screenshot({path:'.aura-integration/premium-students-mobile.png',fullPage:true});
});
test('summary separates follow-up and privacy forms while their areas retain draft protection',async({page})=>{
 await fixture(page);await page.goto(`/alunos/${C}?org=${A}`);await expect(page.getByRole('button',{name:'Acompanhamento',exact:true})).toBeVisible();await expect(page.getByLabel('Objetivo do acompanhamento')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Privacidade e dados'})).toHaveCount(0);
 await page.getByRole('button',{name:'Acompanhamento',exact:true}).click();const field=page.getByRole('textbox',{name:'Objetivo do acompanhamento',exact:true});await field.fill('Rascunho fictício');page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Privacidade',exact:true}).click();await expect(field).toHaveValue('Rascunho fictício');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Privacidade',exact:true}).click();await expect(page.getByRole('heading',{name:'Privacidade e dados'})).toBeVisible();await expect(field).toHaveCount(0);
});
test('coach settings and restricted profile never advertise privileged tools',async({page})=>{
 await fixture(page,{role:'coach',restricted:true});await page.goto('/definicoes');await expect(page.getByRole('link',{name:'Gerir competências',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'Gerir segurança',exact:true})).toBeVisible();
 await page.goto(`/alunos/${C}?org=${A}&section=privacy`);await expect(page.getByRole('button',{name:'Privacidade',exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:'Privacidade e dados'})).toHaveCount(0);
});
test('today schedule uses its own authorized filter and does not change with priority filters',async({page})=>{
 await fixture(page,{seedAppointments:2,seedObjectives:2});const schedule=page.getByRole('region',{name:'Agenda de hoje',exact:true});
 await expect(schedule.getByRole('link',{name:'Ver agenda completa',exact:true})).toHaveAttribute('href','/agenda?org='+A);
 await expect(schedule.locator('.aura-priority-list>li')).toHaveCount(2);const count=2;const priorities=page.getByRole('region',{name:'Prioridades do profissional',exact:true});
 await priorities.getByLabel('Tipo de prioridade').selectOption('objective');await expect(priorities.locator('.aura-priority-list>li')).toHaveCount(2);await expect(schedule.locator('.aura-priority-list>li')).toHaveCount(count);
});
test('new student disclosure retains its draft when collapsed and remains keyboard operable',async({page})=>{
 await fixture(page);await page.goto('/alunos');const disclosure=page.locator('.aura-create-client');await expect(disclosure.getByLabel('Nome',{exact:true})).toBeHidden();const toggle=disclosure.locator('summary');await toggle.focus();await page.keyboard.press('Enter');const input=disclosure.getByLabel('Nome',{exact:true});await input.fill('Aluno exclusivamente fictício');await toggle.click();await expect(input).toBeHidden();await toggle.click();await expect(input).toHaveValue('Aluno exclusivamente fictício');
});
test('mobile profile area selector exposes all authorized areas and preserves cancelled drafts',async({page})=>{
 await page.setViewportSize({width:375,height:812});await fixture(page);await page.goto(`/alunos/${C}?org=${A}&section=care`);
 const areas=page.getByRole('combobox',{name:'Área da ficha',exact:true});await expect(areas).toHaveValue('care');await expect(areas.getByRole('option')).toHaveCount(10);await expect(areas.getByRole('option',{name:'Nutrição · demonstração',exact:true})).toHaveAttribute('value','nutrition');
 const draft=page.getByRole('textbox',{name:'Objetivo do acompanhamento',exact:true});await draft.fill('Rascunho fictício mobile');page.once('dialog',d=>d.dismiss());await areas.selectOption('privacy');await expect(areas).toHaveValue('care');await expect(draft).toHaveValue('Rascunho fictício mobile');
 page.once('dialog',d=>d.accept());await areas.selectOption('privacy');await expect(page.getByRole('heading',{name:'Privacidade e dados',exact:true})).toBeVisible();
 await areas.selectOption('nutrition');await expect(page.getByRole('region',{name:'Nutrição de demonstração'})).toBeVisible();
});
