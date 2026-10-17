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
