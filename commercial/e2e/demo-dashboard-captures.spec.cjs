const {test,expect}=require('@playwright/test');const fs=require('node:fs');const phase=process.env.AURA_DASHBOARD_CAPTURE;
for(const width of [320,375,768,1440])test(`Premium dashboard review ${width}`,async({page})=>{
 test.skip(!['before','after'].includes(phase),'Explicit review captures only');const dir=`/workspace/aura-review/aura-premium-dashboard/${phase}`;fs.mkdirSync(dir,{recursive:true});await page.setViewportSize({width,height:1000});await page.goto('/demo/experiencia');await expect(page.locator('main')).toHaveAttribute('aria-busy','false');
 if(phase==='after')await page.waitForFunction(()=>{const box=document.querySelector('.aura-dashboard .chartbox');if(!box)return false;return box.querySelector('svg')?.viewBox.baseVal.width===Math.min(680,Math.max(320,Math.round(box.getBoundingClientRect().width)));});
 await page.screenshot({path:`${dir}/dashboard-${width}.png`,fullPage:true});await page.screenshot({path:`${dir}/viewport-${width}.png`});
});
test('dashboard empty measurement and weekly agenda review',async({page})=>{
 test.skip(phase!=='after','After-only state capture');await page.setViewportSize({width:375,height:1000});await page.goto('/demo/experiencia');const nav=page.getByRole('navigation',{name:'Áreas da demonstração'});await nav.getByRole('button',{name:'Alunos',exact:true}).click();await page.getByPlaceholder('Ex.: Joana Exemplo').fill('Aluno Sem Medições Exemplo');await page.getByRole('button',{name:'Adicionar aluno',exact:true}).click();await nav.getByRole('button',{name:'Visão geral',exact:true}).click();await page.getByRole('button',{name:'Semana',exact:true}).click();await page.screenshot({path:'/workspace/aura-review/aura-premium-dashboard/after/empty-week-375.png',fullPage:true});
});
