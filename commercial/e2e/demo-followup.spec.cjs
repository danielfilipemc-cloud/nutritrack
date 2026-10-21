const {test,expect}=require('@playwright/test');
const nav=(page,width)=>page.getByRole('navigation',{name:width>800?'Navegação da demonstração':'Áreas da demonstração'});
const priorities=page=>page.getByRole('region',{name:'Prioridades de exemplo',exact:true});
const priority=(page,name)=>priorities(page).getByRole('button',{name:new RegExp(`^Abrir acompanhamento de ${name}:`)});
const heading=page=>page.getByRole('heading',{name:'Acompanhamento do aluno',exact:true});
async function overview(page,width){await nav(page,width).getByRole('button',{name:'Visão geral',exact:true}).click();}
async function care(page,width){if(width<=900)await page.getByRole('combobox',{name:'Área da ficha',exact:true}).selectOption('care');else await page.getByRole('button',{name:'Acompanhamento',exact:true}).click();}
const save=page=>page.getByRole('button',{name:'Guardar acompanhamento',exact:true});
for(const width of [320,375,1440]){
 test(`priority opens the correct followup and only saved changes affect the day ${width}`,async({page},testInfo)=>{
  const origin=new URL(testInfo.project.use.baseURL).origin,external=[];page.on('request',r=>{if(new URL(r.url()).origin!==origin)external.push(r.url());});
  await page.setViewportSize({width,height:900});await page.goto('/demo/experiencia?org=private-fixture&student=private-fixture');
  await expect(page.locator('main.aura-preview')).toHaveAttribute('aria-busy','false');await expect(priority(page,'Sofia Exemplo')).toContainText('Revisão hoje');await priority(page,'Sofia Exemplo').focus();await expect(priority(page,'Sofia Exemplo')).toBeFocused();await page.keyboard.press('Enter');await expect(heading(page)).toBeFocused();await expect(heading(page)).toBeInViewport({ratio:1});
  await expect(page.getByRole('combobox',{name:'Escolher aluno',exact:true})).toHaveValue('1');
  const review=page.getByLabel('Próxima revisão',{exact:true}),goal=page.getByRole('textbox',{name:'Objetivo fictício',exact:true});
  await review.fill('2026-10-25');await goal.fill('  Objetivo fictício da Sofia  ');
  const context=page.locator(width<=900?'.aura-preview-context-mobile summary':'.aura-preview-context-desktop');await expect(context).toContainText('2026-10-20');
  await overview(page,width);await expect(priority(page,'Sofia Exemplo')).toContainText('2026-10-20');await priority(page,'Sofia Exemplo').click();await expect(heading(page)).toBeFocused();await expect(review).toHaveValue('2026-10-25');await expect(goal).toHaveValue('  Objetivo fictício da Sofia  ');
  await save(page).click();await expect(save(page)).toBeFocused();await expect(page.getByRole('status')).toContainText('Acompanhamento fictício guardado');await expect(goal).toHaveValue('Objetivo fictício da Sofia');await expect(context).toContainText('2026-10-25');
  await overview(page,width);await expect(priorities(page).getByText('Sem revisões pendentes no dia de exemplo.',{exact:true})).toBeVisible();
  await priorities(page).getByRole('button',{name:'Consultar acompanhamento de Sofia Exemplo',exact:true}).click();await expect(heading(page)).toBeFocused();
  await review.fill('2026-10-20');await page.getByRole('combobox',{name:'Estado do acompanhamento',exact:true}).selectOption('paused');await save(page).click();await overview(page,width);await expect(priority(page,'Sofia Exemplo')).toHaveCount(0);
  await priorities(page).getByRole('button').click();await page.getByRole('combobox',{name:'Estado do acompanhamento',exact:true}).selectOption('active');await save(page).click();await overview(page,width);await expect(priority(page,'Sofia Exemplo')).toHaveCount(1);
  await priority(page,'Sofia Exemplo').click();await review.fill('');await save(page).click();await overview(page,width);await expect(priority(page,'Sofia Exemplo')).toHaveCount(0);
  await page.getByRole('combobox',{name:'Aluno',exact:true}).selectOption('2');await priorities(page).getByRole('button',{name:'Consultar acompanhamento de Miguel Exemplo',exact:true}).click();await expect(heading(page)).toBeFocused();await expect(page.getByRole('combobox',{name:'Escolher aluno',exact:true})).toHaveValue('2');await expect(goal).not.toHaveValue('Objetivo fictício da Sofia');await expect(page.getByRole('status')).toHaveCount(0);
  await page.reload();await expect(priority(page,'Sofia Exemplo')).toHaveCount(1);expect(external).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
 test(`due reviews sort predictably while student drafts and calendar bounds stay isolated ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/demo/experiencia');await nav(page,width).getByRole('button',{name:'Ficha 360.º',exact:true}).click();await care(page,width);
  await page.getByRole('textbox',{name:'Objetivo fictício',exact:true}).fill('Rascunho Sofia');
  await page.getByRole('combobox',{name:'Escolher aluno',exact:true}).selectOption('2');await care(page,width);await expect(page.getByRole('textbox',{name:'Objetivo fictício',exact:true})).not.toHaveValue('Rascunho Sofia');
  await page.getByLabel('Próxima revisão',{exact:true}).fill('2026-10-19');await save(page).click();await overview(page,width);
  await expect(priorities(page).getByRole('button')).toHaveCount(2);await expect(priorities(page).getByRole('button').first()).toContainText('Miguel Exemplo');await expect(priority(page,'Miguel Exemplo')).toContainText('Revisão em atraso');
  await priority(page,'Sofia Exemplo').click();await expect(page.getByRole('textbox',{name:'Objetivo fictício',exact:true})).toHaveValue('Rascunho Sofia');await page.getByLabel('Próxima revisão',{exact:true}).fill('2026-10-19');await save(page).click();await overview(page,width);await expect(priorities(page).getByRole('button').first()).toContainText('Sofia Exemplo');
  await priority(page,'Miguel Exemplo').click();await page.getByRole('combobox',{name:'Estado do acompanhamento',exact:true}).selectOption('completed');await save(page).click();await overview(page,width);await expect(priority(page,'Miguel Exemplo')).toHaveCount(0);
  await priority(page,'Sofia Exemplo').click();const review=page.getByLabel('Próxima revisão',{exact:true});await review.fill('2101-01-01');await save(page).click();expect(await review.evaluate(el=>el.validity.rangeOverflow)).toBe(true);await overview(page,width);await expect(priority(page,'Sofia Exemplo')).toContainText('2026-10-19');
  await nav(page,width).getByRole('button',{name:'Alunos',exact:true}).click();await page.getByPlaceholder('Ex.: Joana Exemplo').fill('F'.repeat(100));await page.getByRole('button',{name:'Adicionar aluno',exact:true}).click();await care(page,width);await review.fill('2026-10-20');await save(page).click();await overview(page,width);
  const long=priority(page,'F'.repeat(100));await expect(long).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await long.click();await expect(heading(page)).toBeFocused();await expect(page.getByRole('combobox',{name:'Escolher aluno',exact:true})).toHaveValue('4');
 });
}
