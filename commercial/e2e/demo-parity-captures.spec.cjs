const {test,expect}=require('@playwright/test');
const {fixture,A,C}=require('./fixtures.cjs');
const fs=require('node:fs');
const phase=process.env.AURA_CAPTURE_PHASE;
test.skip(!['before','after'].includes(phase),'Explicit local review capture only');
async function setup(page,width){
 const dir=`docs/review/demo-professional-parity/${phase}`;fs.mkdirSync(dir,{recursive:true});
 await page.setViewportSize({width,height:1000});
 await page.clock.install({time:new Date('2026-10-20T12:00:00Z')});
 return name=>page.screenshot({path:`${dir}/${name}-${width}.png`,fullPage:true});
}
for(const width of [375,1440]){
 test(`parity demo review captures ${width}`,async({page})=>{
  test.setTimeout(240000);const shot=await setup(page,width);
  await page.goto('/demo/experiencia');
  await expect(page.getByRole('heading',{name:/O teu dia/})).toBeVisible();await shot('demo-dashboard');
  const nav=page.getByRole('navigation',{name:width>800?'Navegação da demonstração':'Áreas da demonstração'});
  await nav.getByRole('button',{name:'Ficha 360.º'}).click();await shot('demo-summary');
  if(phase==='before'){
   await page.getByRole('button',{name:'Evolução e avaliações'}).click();await shot('demo-assessments');
   await page.getByRole('button',{name:'Agenda e acompanhamento',exact:true}).click();await shot('demo-care');
  }else{
   for(const [value,name] of [['assessments','demo-assessments'],['evolution','demo-evolution'],['agenda','demo-agenda'],['care','demo-care']]){
    if(width<=900)await page.getByRole('combobox',{name:'Área da ficha',exact:true}).selectOption(value);
    else await page.getByRole('navigation',{name:'Secções da ficha',exact:true}).getByRole('button',{name:({assessments:'Avaliações',evolution:'Evolução',agenda:'Agenda do aluno',care:'Acompanhamento'})[value],exact:true}).click();
    await shot(name);
   }
  }
 });
 test(`parity professional review captures ${width}`,async({page})=>{
  test.setTimeout(240000);const shot=await setup(page,width);
  await fixture(page,{seedAppointments:2,seedObjectives:2,referenceDate:'2026-10-20'});
  await expect(page.getByRole('region',{name:'Evolução individual na dashboard',exact:true})).toHaveAttribute('aria-busy','false');await shot('professional-dashboard');
  await page.goto(`/alunos/${C}?org=${A}&section=overview`);
  await expect(page.getByRole('heading',{name:'Evolução recente',exact:true})).toBeVisible({timeout:30000});
  await expect(page.locator('.aura-student-context')).toHaveAttribute('aria-busy','false',{timeout:30000});
  await shot('professional-summary');
 });
}
test('compact empty student and drafted form',async({page})=>{
 test.skip(phase!=='after');test.setTimeout(120000);
 await page.setViewportSize({width:320,height:900});await page.goto('/demo/experiencia');
 await page.getByRole('navigation',{name:'Áreas da demonstração'}).getByRole('button',{name:'Alunos',exact:true}).click();
 await page.getByPlaceholder('Ex.: Joana Exemplo').fill('Aluno Novo Exemplo');await page.getByRole('button',{name:'Adicionar aluno'}).click();
 await expect(page.getByText('Sem medição',{exact:true})).toHaveCount(3);
 await page.screenshot({path:'docs/review/demo-professional-parity/after/demo-empty-320.png',fullPage:true});
 await page.getByRole('combobox',{name:'Área da ficha',exact:true}).selectOption('assessments');
 await page.getByLabel('Peso (kg)',{exact:true}).fill('68.5');
 await page.screenshot({path:'docs/review/demo-professional-parity/after/demo-draft-320.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
