const {test,expect}=require('@playwright/test');
const {fixture,A,C}=require('./fixtures.cjs');
const pages=[['dashboard','/'],['students','/alunos'],['profile',`/alunos/${C}?org=${A}`],['agenda','/agenda'],['brand','/marca'],['settings','/definicoes']];
for(const width of [375,1440])for(const [name,path] of pages)test(`premium ${name} at ${width}px: content, keyboard target and bounded layout`,async({page})=>{
 await page.setViewportSize({width,height:1000});await fixture(page,{seedAppointments:2});await page.goto(path);
 await expect(page.getByRole('heading',{level:1})).toBeVisible();await expect(page.getByRole('combobox',{name:/^Estabelecimento/})).toHaveCount(1);
 if(name==='profile')await expect(page.getByRole('heading',{name:'Resumo da evolução',exact:true})).toBeVisible();
 if(name==='dashboard')await expect(page.getByLabel('Indicadores do estabelecimento')).toBeVisible();
 if(name==='brand')await expect(page.getByLabel('Cor principal')).toBeEnabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 await page.screenshot({path:`.aura-integration/premium-${name}-${width}.png`,fullPage:true});
});
