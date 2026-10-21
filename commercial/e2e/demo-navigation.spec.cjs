const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const phase=process.env.AURA_USABILITY_CAPTURE;
async function capture(page,name){
 if(!['before','after'].includes(phase))return;
 const dir=`.aura-integration/demo-usability/${phase}`;fs.mkdirSync(dir,{recursive:true});
 await page.screenshot({path:`${dir}/${name}.png`,fullPage:true});
}
const nav=(page,width)=>page.getByRole('navigation',{name:width>800?'Navegação da demonstração':'Áreas da demonstração'});
for(const width of [375,1440]){
 test(`summary shortcut lands keyboard focus on the destination ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/demo/experiencia');
  await nav(page,width).getByRole('button',{name:'Ficha 360.º'}).click();
  const action=page.getByRole('button',{name:'Editar acompanhamento →',exact:true});
  await action.focus();await action.press('Enter');
  const title=page.getByRole('heading',{name:'Acompanhamento do aluno',exact:true});
  await expect(title).toBeVisible();await capture(page,`shortcut-${width}`);
  await expect(title).toBeFocused();
  await expect(title).toBeInViewport({ratio:1});
  await page.keyboard.press('Tab');await expect(page.getByRole('combobox',{name:'Estado do acompanhamento',exact:true})).toBeFocused();
  await page.getByRole('combobox',{name:'Estado do acompanhamento',exact:true}).selectOption('paused');
  await expect(page.getByRole('combobox',{name:'Estado do acompanhamento',exact:true})).toBeFocused();
 });
 test(`deep mobile navigation exposes the new page heading ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/demo/experiencia');
  await nav(page,width).getByRole('button',{name:'Ficha 360.º'}).click();
  await page.getByRole('button',{name:'Consultar agenda →',exact:true}).click();
  await page.getByRole('button',{name:'Abrir agenda geral →',exact:true}).click();
  const title=page.getByRole('heading',{name:'Agenda de exemplo',exact:true});
  await expect(title).toBeVisible();await capture(page,`agenda-navigation-${width}`);
  await expect(title).toBeFocused();
  await expect(title).toBeInViewport({ratio:1});
 });
}
for(const width of [320,1440])test(`valid long names stay inside their layout ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/demo/experiencia');
 await nav(page,width).getByRole('button',{name:'A tua marca',exact:true}).click();
 await page.getByLabel('Nome do espaço',{exact:true}).fill('D'.repeat(70));
 await capture(page,`long-brand-${width}`);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const selector of ['.aura-preview-top strong',...(width>800?['.aura-preview-sidefoot strong']:[])]){
  expect(await page.locator(selector).evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 }
 await nav(page,width).getByRole('button',{name:'Alunos',exact:true}).click();
 await page.getByPlaceholder('Ex.: Joana Exemplo').fill('F'.repeat(100));await page.getByRole('button',{name:'Adicionar aluno',exact:true}).click();
 await expect(page.getByRole('heading',{name:'F'.repeat(100),exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('keyboard creation starts at the new student and editing retains focus',async({page})=>{
 await page.setViewportSize({width:375,height:900});await page.goto('/demo/experiencia');
 await nav(page,375).getByRole('button',{name:'Alunos',exact:true}).click();
 const name=page.getByPlaceholder('Ex.: Joana Exemplo');await name.fill('Foco Exemplo');await name.press('Enter');
 await expect(page.getByRole('heading',{name:'Foco Exemplo',exact:true})).toBeFocused();
 await page.getByRole('combobox',{name:'Área da ficha',exact:true}).selectOption('assessments');
 const input=page.getByLabel('Peso (kg)',{exact:true});await input.fill('68.5');await expect(input).toBeFocused();
 await page.getByRole('button',{name:'Guardar avaliação',exact:true}).click();
 await expect(page.getByRole('button',{name:'Guardar avaliação',exact:true})).toBeFocused();
 await expect(page.getByRole('cell',{name:'68.5',exact:true})).toBeVisible();
});
