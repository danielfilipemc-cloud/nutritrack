const {test,expect}=require('@playwright/test');
const {fixture}=require('./fixtures.cjs');
for(const width of [375,1280,1440])test(`daily work is visible early at ${width}px without hiding KPI data`,async({page})=>{
 await page.setViewportSize({width,height:width===375?812:1000});await fixture(page,{seedAppointments:2,seedObjectives:3});
 const queue=page.getByRole('region',{name:'Prioridades do profissional',exact:true});await expect(queue.getByRole('heading',{name:'Prioridades de hoje'})).toBeVisible();
 await expect(page.getByLabel('Indicadores do estabelecimento')).toContainText('Alunos ativos');
 expect((await queue.boundingBox()).y).toBeLessThan(width===375?800:520);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+2);
 if(width===1440)expect((await queue.getByRole('link',{name:/Registar avaliação/}).first().boundingBox()).y).toBeLessThan(950);
 const summary=page.locator('.aura-dashboard-secondary>summary').first();await summary.focus();await page.keyboard.press('Enter');await expect(page.getByRole('link',{name:'Abrir ficha de Aluno Fictício A',exact:true})).toBeVisible();
});

test('workspace refinements do not add the professional shell to the public demonstration',async({page})=>{
 await fixture(page);await page.goto('/demo');await expect(page.locator('.aura-workspace')).toHaveCount(0);await expect(page.getByRole('heading',{level:1})).toBeVisible();
});
