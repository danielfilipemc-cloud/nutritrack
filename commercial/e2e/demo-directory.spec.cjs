const {test,expect}=require('@playwright/test');
const nav=(page,width)=>page.getByRole('navigation',{name:width>800?'Navegação da demonstração':'Áreas da demonstração'});
const directory=page=>page.getByRole('region',{name:'Diretório',exact:true});
const row=(page,name)=>directory(page).getByRole('button',{name:new RegExp(`^${name} (Em acompanhamento|Em pausa|Concluído) Ficha 360.º →$`)});
const search=page=>page.getByRole('searchbox',{name:'Pesquisar alunos',exact:true});
const filter=page=>directory(page).getByRole('combobox',{name:'Estado do acompanhamento',exact:true});
async function students(page,width){await nav(page,width).getByRole('button',{name:'Alunos',exact:true}).click();}
async function area(page,width,value){if(width<=900)await page.getByRole('combobox',{name:'Área da ficha',exact:true}).selectOption(value);else await page.getByRole('navigation',{name:'Secções da ficha',exact:true}).getByRole('button',{name:{care:'Acompanhamento',assessments:'Avaliações',evolution:'Evolução',overview:'Resumo'}[value],exact:true}).click();}
const summary=page=>page.getByRole('heading',{name:'Resumo da evolução',exact:true});
for(const width of [320,375,1440]){
 test(`directory search and saved status preserve focus, selection and per-student drafts ${width}`,async({page},testInfo)=>{
  const forbidden=[],origin=new URL(testInfo.project.use.baseURL).origin;
  page.on('request',r=>{const u=new URL(r.url());if(u.origin!==origin||/^\/(api|auth|rest)\//.test(u.pathname))forbidden.push(u.origin+u.pathname);});
  await page.setViewportSize({width,height:900});await page.goto('/demo/experiencia?org=private-fixture&student=private-fixture');await students(page,width);
  await expect(directory(page).getByRole('status')).toHaveText('3 de 3 alunos');
  await page.getByPlaceholder('Ex.: Joana Exemplo').fill('Rascunho de criação');
  for(const term of ['ines',' INÊS   exemplo ','Ine\u0302s']){await search(page).fill(term);await expect(row(page,'Inês Exemplo')).toBeVisible();await expect(directory(page).getByRole('status')).toHaveText('1 de 3 alunos');}
  await search(page).press('Enter');await expect(search(page)).toBeFocused();
  await search(page).fill('ines');await filter(page).selectOption('active');
  await row(page,'Inês Exemplo').focus();await expect(row(page,'Inês Exemplo')).toBeFocused();await page.keyboard.press('Enter');
  await expect(summary(page)).toBeFocused();await expect(summary(page)).toBeInViewport({ratio:1});await expect(page.getByRole('combobox',{name:'Escolher aluno',exact:true})).toHaveValue('3');
  await area(page,width,'care');await page.getByRole('combobox',{name:'Estado do acompanhamento',exact:true}).selectOption('paused');await page.getByRole('textbox',{name:'Objetivo fictício',exact:true}).fill('Rascunho só da Inês');
  await students(page,width);await expect(search(page)).toHaveValue('ines');await expect(filter(page)).toHaveValue('active');await expect(row(page,'Inês Exemplo')).toContainText('Em acompanhamento');await expect(page.getByPlaceholder('Ex.: Joana Exemplo')).toHaveValue('Rascunho de criação');
  await row(page,'Inês Exemplo').click();await expect(summary(page)).toBeFocused();await area(page,width,'care');await expect(page.getByRole('textbox',{name:'Objetivo fictício',exact:true})).toHaveValue('Rascunho só da Inês');
  await page.getByRole('button',{name:'Guardar acompanhamento',exact:true}).click();await students(page,width);await expect(row(page,'Inês Exemplo')).toHaveCount(0);await expect(directory(page).getByRole('status')).toHaveText('0 de 3 alunos');await expect(page.getByRole('heading',{name:'Sem alunos encontrados',exact:true})).toBeVisible();
  await filter(page).focus();await filter(page).selectOption('paused');await expect(row(page,'Inês Exemplo')).toContainText('Em pausa');await expect(filter(page)).toBeFocused();
  await row(page,'Inês Exemplo').click();await area(page,width,'care');await page.getByRole('combobox',{name:'Estado do acompanhamento',exact:true}).selectOption('completed');await page.getByRole('button',{name:'Guardar acompanhamento',exact:true}).click();await students(page,width);await expect(row(page,'Inês Exemplo')).toHaveCount(0);
  await filter(page).selectOption('completed');await expect(row(page,'Inês Exemplo')).toContainText('Concluído');await search(page).fill('%_[.*');await expect(row(page,'Inês Exemplo')).toHaveCount(0);
  await page.getByRole('button',{name:'Limpar pesquisa e filtros',exact:true}).click();await expect(search(page)).toBeFocused();await expect(search(page)).toHaveValue('');await expect(filter(page)).toHaveValue('all');await expect(directory(page).getByRole('status')).toHaveText('3 de 3 alunos');
  await nav(page,width).getByRole('button',{name:'Ficha 360.º',exact:true}).click();await expect(page.getByRole('combobox',{name:'Escolher aluno',exact:true})).toHaveValue('3');
  await page.getByRole('combobox',{name:'Escolher aluno',exact:true}).selectOption('1');await area(page,width,'care');await expect(page.getByRole('textbox',{name:'Objetivo fictício',exact:true})).not.toHaveValue('Rascunho só da Inês');
  await students(page,width);await row(page,'Sofia Exemplo').click();await expect(summary(page)).toBeFocused();await students(page,width);await row(page,'Sofia Exemplo').click();await expect(summary(page)).toBeFocused();
  expect(forbidden).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.reload();await students(page,width);await expect(search(page)).toHaveValue('');await expect(filter(page)).toHaveValue('all');await expect(row(page,'Inês Exemplo')).toContainText('Em acompanhamento');await expect(page.getByPlaceholder('Ex.: Joana Exemplo')).toHaveValue('');
 });
 test(`new long-name student can be found, assessed and reopened without touching private storage ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/demo/experiencia');
  await page.evaluate(()=>{localStorage.setItem('directory-private-canary','PRIVATE_FIXTURE_ONLY');sessionStorage.setItem('directory-session-canary','PRIVATE_SESSION_FIXTURE');});
  const storage=()=>page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}));const before=await storage();
  await students(page,width);const name='Á'+'F'.repeat(98)+'Ç';await page.getByPlaceholder('Ex.: Joana Exemplo').fill(name);await page.getByRole('button',{name:'Adicionar aluno',exact:true}).click();
  await students(page,width);await search(page).fill('a'+'f'.repeat(98)+'c');await expect(directory(page).getByRole('status')).toHaveText('1 de 4 alunos');await expect(row(page,name)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await row(page,name).click();const empty=page.getByRole('heading',{name:'Começar o acompanhamento',exact:true});await expect(empty).toBeFocused();await expect(empty).toBeInViewport({ratio:1});
  await page.getByRole('button',{name:'Registar primeira avaliação',exact:true}).click();await page.getByLabel('Peso (kg)',{exact:true}).fill('64.5');await page.getByRole('button',{name:'Guardar avaliação',exact:true}).click();
  await area(page,width,'evolution');await page.getByText('Consultar medições em tabela',{exact:true}).click();await expect(page.getByRole('cell',{name:'64.5',exact:true})).toBeVisible();await students(page,width);await expect(search(page)).toHaveValue('a'+'f'.repeat(98)+'c');await row(page,name).click();await expect(summary(page)).toBeFocused();await expect(summary(page)).toBeInViewport({ratio:1});await expect(page.getByRole('combobox',{name:'Escolher aluno',exact:true})).toHaveValue('4');await expect(page.locator('.aura-preview-summary')).toContainText('64.5 kg');
  expect(await storage()).toEqual(before);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
