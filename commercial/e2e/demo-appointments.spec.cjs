const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const phase=process.env.AURA_APPOINTMENT_CAPTURE;
const nav=(page,width)=>page.getByRole('navigation',{name:width>800?'Navegação da demonstração':'Áreas da demonstração'});
async function agenda(page,width){await nav(page,width).getByRole('button',{name:'Agenda',exact:true}).click();}
async function area(page,width,value){if(width<=900)await page.getByRole('combobox',{name:'Área da ficha',exact:true}).selectOption(value);else await page.getByRole('navigation',{name:'Secções da ficha',exact:true}).getByRole('button',{name:({agenda:'Agenda do aluno',overview:'Resumo'})[value],exact:true}).click();}
for(const width of [320,375,1440]){
 test(`create a local booking and follow it through the demo ${width}`,async({page},testInfo)=>{
  const origin=new URL(testInfo.project.use.baseURL||'http://127.0.0.1:3187').origin;
  const external=[];page.on('request',request=>{if(new URL(request.url()).origin!==origin)external.push(request.url());});
  await page.setViewportSize({width,height:900});await page.goto('/demo/experiencia?org=private-fixture&student=private-fixture');await agenda(page,width);
  await page.getByRole('button',{name:'Nova marcação de exemplo →',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('heading',{name:'Criar marcação fictícia',exact:true})).toBeFocused();
  await page.getByRole('combobox',{name:'Aluno da marcação',exact:true}).selectOption('2');
  await page.getByLabel('Hora da marcação',{exact:true}).fill('15:15');
  await page.getByRole('button',{name:'Criar marcação fictícia',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Marcação fictícia criada');
  const row=page.locator('.aura-preview-bookings li').filter({hasText:'15:15–15:45'});await expect(row).toContainText('Miguel Exemplo');
  await expect(page.getByRole('button',{name:'Criar marcação fictícia',exact:true})).toBeFocused();
  await row.getByRole('button',{name:'Abrir ficha de Miguel Exemplo',exact:true}).click();await area(page,width,'agenda');await expect(page.locator('.aura-preview-hubbody').getByText('2026-10-20 · 15:15–15:45',{exact:true})).toBeVisible();
  await page.getByRole('combobox',{name:'Escolher aluno',exact:true}).selectOption('1');await area(page,width,'agenda');await expect(page.locator('.aura-preview-hubbody').getByText('2026-10-20 · 15:15–15:45',{exact:true})).toHaveCount(0);
  await nav(page,width).getByRole('button',{name:'Visão geral',exact:true}).click();
  await expect(page.locator('.aura-preview-stats article').filter({hasText:'Marcações no dia de exemplo'})).toContainText('4');await expect(page.getByText('15:15',{exact:true})).toBeVisible();
  await agenda(page,width);await page.getByLabel('Data da marcação',{exact:true}).fill('2026-10-21');await page.getByLabel('Hora da marcação',{exact:true}).fill('09:00');await page.getByRole('button',{name:'Criar marcação fictícia',exact:true}).click();
  await expect(page.getByLabel('Data da consulta',{exact:true})).toHaveValue('2026-10-21');await expect(page.locator('.aura-preview-bookings li')).toHaveCount(1);
  await page.getByRole('combobox',{name:'Vista da agenda',exact:true}).selectOption('week');await expect(page.locator('.aura-preview-bookings li')).toHaveCount(5);
  await page.getByRole('combobox',{name:'Filtrar por aluno',exact:true}).selectOption('2');await expect(page.locator('.aura-preview-bookings li')).toHaveCount(3);
  await nav(page,width).getByRole('button',{name:'Visão geral',exact:true}).click();await expect(page.locator('.aura-preview-stats article').filter({hasText:'Marcações no dia de exemplo'})).toContainText('4');
  await page.reload();await agenda(page,width);await expect(page.locator('.aura-preview-bookings li')).toHaveCount(3);expect(external).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
 test(`booking validation and drafts survive navigation ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/demo/experiencia');await agenda(page,width);
  const time=page.getByLabel('Hora da marcação',{exact:true});await time.fill('09:15');await page.getByRole('button',{name:'Criar marcação fictícia',exact:true}).click();
  await expect(page.locator('#demo-booking-error')).toContainText('sobrepõe');await expect(time).toBeFocused();await expect(time).toHaveAttribute('aria-invalid','true');await expect(time).toHaveAccessibleDescription(/sobrepõe/);await expect(page.locator('.aura-preview-bookings li')).toHaveCount(3);
  await time.fill('18:00');await expect(page.locator('#demo-booking-error')).toHaveCount(0);
  await nav(page,width).getByRole('button',{name:'Ficha 360.º',exact:true}).click();await agenda(page,width);await expect(time).toHaveValue('18:00');
  await page.getByLabel('Data da consulta',{exact:true}).fill('');await expect(page.getByText('Consulta sem data válida',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Anterior',exact:true})).toBeDisabled();
  await page.getByLabel('Data da consulta',{exact:true}).fill('2026-11-01');await expect(page.getByText('Sem marcações de exemplo neste período e filtro.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Dia de referência',exact:true}).click();await expect(page.locator('.aura-preview-bookings li')).toHaveCount(3);
  await page.getByLabel('Data da consulta',{exact:true}).fill('2000-01-01');await expect(page.getByRole('button',{name:'Anterior',exact:true})).toBeDisabled();
  await page.getByLabel('Data da consulta',{exact:true}).fill('2100-12-31');await expect(page.getByRole('button',{name:'Seguinte',exact:true})).toBeDisabled();
  await nav(page,width).getByRole('button',{name:'Alunos',exact:true}).click();await page.getByPlaceholder('Ex.: Joana Exemplo').fill('F'.repeat(100));await page.getByRole('button',{name:'Adicionar aluno',exact:true}).click();await agenda(page,width);
  await page.getByRole('combobox',{name:'Aluno da marcação',exact:true}).selectOption('4');await page.getByRole('combobox',{name:'Filtrar por aluno',exact:true}).selectOption('4');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
 test(`agenda review capture ${width}`,async({page})=>{
  test.skip(!['before','after'].includes(phase),'Explicit local capture only');
  const dir=`.aura-integration/appointment-create/${phase}`;fs.mkdirSync(dir,{recursive:true});
  await page.setViewportSize({width,height:900});await page.goto('/demo/experiencia');await agenda(page,width);await page.screenshot({path:`${dir}/agenda-${width}.png`,fullPage:true});
  if(phase==='after'){
   await page.getByRole('button',{name:'Criar marcação fictícia',exact:true}).click();await expect(page.getByRole('status')).toContainText('Marcação fictícia criada');await page.screenshot({path:`${dir}/created-${width}.png`,fullPage:true});
   await page.getByRole('combobox',{name:'Vista da agenda',exact:true}).selectOption('week');await page.screenshot({path:`${dir}/week-${width}.png`,fullPage:true});
  }
 });
}
