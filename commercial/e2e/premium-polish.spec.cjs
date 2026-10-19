const {test,expect}=require('@playwright/test');
const {fixture,A,C}=require('./fixtures.cjs');
const fs=require('node:fs');
const directory='.aura-integration/premium-polish/after';fs.mkdirSync(directory,{recursive:true});
for(const width of [375,1440])for(const [name,url] of [['dashboard','/'],['agenda','/agenda'],['profile',`/alunos/${C}?org=${A}`]])test(`final polish ${name} ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await fixture(page,{seedObjectives:3,seedAppointments:2,seedTimeline:16});await page.goto(url);
 if(name==='dashboard'){
  await expect(page.getByLabel('Indicadores do estabelecimento')).toBeVisible();
  const size=await page.locator('.stat small').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));expect(size).toBeGreaterThanOrEqual(width>900?13:11);
  await expect(page.getByRole('navigation',{name:'Operações frequentes'}).getByRole('link')).toHaveCount(5);
 }
 if(name==='agenda')await expect(page.locator('.aura-appointment-list>li')).toHaveCount(2);
 if(name==='profile'){
  await expect(page.getByRole('heading',{name:'Resumo da evolução',exact:true})).toBeVisible();
  if(width>900){const nav=page.getByRole('navigation',{name:'Secções da ficha'});await expect(nav.getByRole('group')).toHaveCount(3);await expect(nav.getByRole('button')).toHaveCount(10);await expect(nav.getByRole('button',{name:'Resumo',exact:true})).toHaveAttribute('aria-pressed','true');}
 }
 if(width<900){const header=await page.locator('.aura-workspace-header').boundingBox();expect(header.height).toBeLessThan(150);for(const label of ['Segurança','Terminar sessão'])await expect(page.getByRole(label==='Segurança'?'link':'button',{name:label,exact:true})).toBeVisible();}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`${directory}/${name}-${width}.png`,fullPage:true});
});

test('mobile agenda secondary actions are keyboard discoverable and collapsing keeps the editor draft',async({page})=>{
 await page.setViewportSize({width:375,height:900});await fixture(page,{seedAppointments:2});await page.goto('/agenda');const row=page.locator('.aura-appointment-list>li').first();const summary=row.locator('summary');
 await expect(row.getByRole('link',{name:'Ficha do aluno',exact:true})).toBeVisible();await expect(row.getByRole('button',{name:'Cancelar marcação',exact:true})).toBeHidden();
 await summary.focus();await page.keyboard.press('Enter');await expect(row.getByRole('button',{name:'Cancelar marcação',exact:true})).toBeVisible();
 await row.getByRole('button',{name:'Editar marcação',exact:true}).click();const start=page.getByLabel('Data e hora (Lisboa)',{exact:true});await start.fill('2091-06-15T13:45');
 await summary.focus();await page.keyboard.press('Enter');await expect(summary).toBeFocused();await expect(start).toHaveValue('2091-06-15T13:45');
 await page.keyboard.press('Enter');await expect(start).toHaveValue('2091-06-15T13:45');expect((await row.getByRole('link',{name:'Ficha do aluno',exact:true}).boundingBox()).height).toBeLessThan(80);await page.screenshot({path:`${directory}/agenda-actions-375.png`,fullPage:true});
});

test('grouped profile navigation retains keyboard operation and cancelled draft navigation',async({page})=>{
 await fixture(page);await page.goto(`/alunos/${C}?org=${A}&section=care`);const draft=page.getByRole('textbox',{name:'Objetivo do acompanhamento',exact:true});await expect(draft).toBeEnabled();await draft.fill('Rascunho fictício de acabamento');await expect(page.getByRole('button',{name:'Guardar acompanhamento',exact:true})).toBeEnabled();
 const target=page.getByRole('navigation',{name:'Secções da ficha'}).getByRole('button',{name:'Objetivos',exact:true});await target.focus();page.once('dialog',dialog=>dialog.dismiss());await page.keyboard.press('Enter');await expect(draft).toHaveValue('Rascunho fictício de acabamento');
 page.once('dialog',dialog=>dialog.accept());await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'Objetivos de acompanhamento',exact:true})).toBeVisible();
});
