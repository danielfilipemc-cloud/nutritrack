const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const phase=process.env.AURA_MOBILE_CAPTURE;
const nav=(page,width)=>page.getByRole('navigation',{name:width>800?'Navegação da demonstração':'Áreas da demonstração'});
test('server-rendered demo waits for hydration before accepting interaction',async({page})=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/_next/static/**/*.js',async route=>{await gate;await route.continue();});
 try{
  await page.setViewportSize({width:375,height:900});await page.goto('/demo/experiencia',{waitUntil:'commit'});
  const main=page.locator('main.aura-preview');await expect(main).toHaveAttribute('inert','');await expect(main).toHaveAttribute('aria-busy','true');
  await page.locator('.aura-preview-mobiletabs button').filter({hasText:'Ficha 360.º'}).click({force:true});
  release();await expect(main).not.toHaveAttribute('inert','');await expect(main).toHaveAttribute('aria-busy','false');
  await expect(page.getByRole('heading',{name:/O teu dia/})).toBeVisible();
  await nav(page,375).getByRole('button',{name:'Ficha 360.º',exact:true}).click();await expect(page.getByRole('heading',{name:'Sofia Exemplo',exact:true})).toBeVisible();
 }finally{release();}
});
async function area(page,width,value){
 if(width<=900)await page.getByRole('combobox',{name:'Área da ficha',exact:true}).selectOption(value);
 else await page.getByRole('navigation',{name:'Secções da ficha',exact:true}).getByRole('button',{name:{overview:'Resumo',assessments:'Avaliações',evolution:'Evolução',care:'Acompanhamento'}[value],exact:true}).click();
}
for(const width of [320,375,1440]){
 test(`profile context and form feedback stay usable ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/demo/experiencia');
  await nav(page,width).getByRole('button',{name:'Ficha 360.º',exact:true}).click();
  const context=page.locator('.aura-preview-context-mobile');
  if(width<=900){
   await expect(context).not.toHaveAttribute('open','');
   await expect(page.getByRole('heading',{name:'Resumo da evolução',exact:true})).toBeInViewport({ratio:1});
   await context.locator('summary').focus();await page.keyboard.press('Enter');
   await expect(context).toHaveAttribute('open','');await expect(context.getByText('Profissional Exemplo',{exact:true})).toBeVisible();
   await context.locator('summary').press('Enter');
  }else await expect(page.locator('.aura-preview-context-desktop').getByText('Profissional Exemplo',{exact:true})).toBeVisible();
  await area(page,width,'assessments');
  await page.getByRole('button',{name:'Guardar avaliação',exact:true}).click();
  const weight=page.getByLabel('Peso (kg)',{exact:true});
  await expect(weight).toBeFocused();await expect(weight).toHaveAttribute('aria-invalid','true');
  await expect(weight).toHaveAccessibleDescription(/Preenche pelo menos uma medição/);
  const alert=page.locator('.aura-preview-hubbody').getByRole('alert');await expect(alert).toHaveText('Preenche pelo menos uma medição.');
  expect(await alert.evaluate(el=>el.closest('section').querySelector('h2').textContent)).toBe('Registar avaliação fictícia');
  await weight.fill('68.5');await expect(weight).not.toHaveAttribute('aria-invalid','true');await expect(alert).toHaveCount(0);
  await page.getByRole('button',{name:'Guardar avaliação',exact:true}).click();
  await expect(page.getByRole('button',{name:'Guardar avaliação',exact:true})).toBeFocused();
  await expect(page.getByRole('status')).toContainText('Avaliação fictícia guardada');
  await area(page,width,'care');await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button',{name:'Guardar acompanhamento',exact:true}).click();await expect(page.getByRole('status')).toContainText('Acompanhamento fictício guardado');
  await area(page,width,'assessments');await expect(page.getByRole('status')).toContainText('Avaliação fictícia guardada');
  await page.getByRole('combobox',{name:'Escolher aluno',exact:true}).selectOption('2');await expect(page.getByRole('status')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
 test(`empty profile leads to a first measurement and back ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/demo/experiencia');
  await nav(page,width).getByRole('button',{name:'Alunos',exact:true}).click();
  await page.getByPlaceholder('Ex.: Joana Exemplo').fill('Primeira Avaliação Exemplo');await page.getByRole('button',{name:'Adicionar aluno',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Começar o acompanhamento',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Registar primeira avaliação',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Registar avaliação fictícia',exact:true})).toBeFocused();
  await page.getByLabel('Peso (kg)',{exact:true}).fill('68.5');
  await area(page,width,'care');await area(page,width,'assessments');await expect(page.getByLabel('Peso (kg)',{exact:true})).toHaveValue('68.5');
  await page.getByRole('button',{name:'Guardar avaliação',exact:true}).click();await area(page,width,'overview');
  await expect(page.getByRole('button',{name:'Registar primeira avaliação',exact:true})).toHaveCount(0);await expect(page.getByText('68.5 kg',{exact:true})).toBeVisible();
  await area(page,width,'evolution');await page.getByRole('combobox',{name:'Indicador da evolução',exact:true}).selectOption('height');
  await page.getByRole('button',{name:'Registar medição de altura',exact:true}).click();await expect(page.getByRole('heading',{name:'Registar avaliação fictícia',exact:true})).toBeFocused();
 });
 test(`mobile flow review captures ${width}`,async({page})=>{
  test.skip(!['before','after'].includes(phase),'Explicit local capture only');
  const dir=`.aura-integration/mobile-student-flow/${phase}`;fs.mkdirSync(dir,{recursive:true});
  await page.setViewportSize({width,height:900});await page.goto('/demo/experiencia');
  await nav(page,width).getByRole('button',{name:'Ficha 360.º',exact:true}).click();
  await page.screenshot({path:`${dir}/summary-${width}.png`,fullPage:true});
  await area(page,width,'assessments');await page.getByRole('button',{name:'Guardar avaliação',exact:true}).click();
  await page.screenshot({path:`${dir}/assessment-error-${width}.png`,fullPage:true});
  await nav(page,width).getByRole('button',{name:'Alunos',exact:true}).click();
  await page.getByPlaceholder('Ex.: Joana Exemplo').fill('Primeira Avaliação Exemplo');await page.getByRole('button',{name:'Adicionar aluno',exact:true}).click();
  await page.screenshot({path:`${dir}/empty-${width}.png`,fullPage:true});
 });
}
