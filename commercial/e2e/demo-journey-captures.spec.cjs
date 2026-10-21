const {test}=require('@playwright/test');const fs=require('node:fs');const phase=process.env.AURA_JOURNEY_CAPTURE;
for(const width of [320,375,1440])test(`student journey review captures ${width}`,async({page})=>{
 test.skip(!['before','after'].includes(phase),'Explicit review capture only');test.setTimeout(120000);
 const dir=`.aura-integration/journey/${phase}`;fs.mkdirSync(dir,{recursive:true});
 await page.setViewportSize({width,height:1000});await page.goto('/demo/experiencia');const nav=page.getByRole('navigation',{name:width>800?'Navegação da demonstração':'Áreas da demonstração'});
 await nav.getByRole('button',{name:'Alunos',exact:true}).click();await page.screenshot({path:`${dir}/directory-${width}.png`,fullPage:true});
 await nav.getByRole('button',{name:'Ficha 360.º',exact:true}).click();await page.screenshot({path:`${dir}/summary-${width}.png`,fullPage:true});
 for(const [section,label] of [['evolution','Evolução'],['agenda','Agenda do aluno']]){
  if(width<=900)await page.getByRole('combobox',{name:'Área da ficha',exact:true}).selectOption(section);else await page.getByRole('navigation',{name:'Secções da ficha',exact:true}).getByRole('button',{name:label,exact:true}).click();
  await page.screenshot({path:`${dir}/${section}-${width}.png`,fullPage:true});
 }
});
