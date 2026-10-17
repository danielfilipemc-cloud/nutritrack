const {test,expect}=require('@playwright/test');
const {fixture,A,B,C,U,today}=require('./fixtures.cjs');
test('dashboard retries errors and opens a student profile with preserved history',async({page})=>{
 await fixture(page,{dashboardError:true});await expect(page.getByRole('alert').filter({hasText:'Não foi possível carregar'})).toContainText('Não foi possível carregar');await page.getByRole('button',{name:'Tentar novamente'}).click();
 await expect(page.getByLabel('Indicadores do estabelecimento')).toContainText('7');
 await page.getByRole('link',{name:'Abrir ficha de Aluno Fictício A'}).click();
 await expect(page.getByRole('heading',{name:'Ficha do aluno',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Aluno Fictício A'})).toBeVisible();
 await page.getByRole('button',{name:'Avaliações',exact:true}).click();await expect(page.getByRole('heading',{name:'Histórico (1)'})).toBeVisible();await expect(page.getByRole('img',{name:/Evolução/})).toBeVisible();
 await page.getByLabel('Peso (kg)',{exact:true}).fill('79.5');await page.getByRole('button',{name:'Guardar avaliação'}).click();
 await expect(page.getByRole('heading',{name:'Histórico (2)'})).toBeVisible();await expect(page.getByRole('status')).toContainText('Avaliação guardada');
});

test('late dashboard response cannot repopulate another establishment',async({page})=>{
 await fixture(page,{slowA:true});await page.getByRole('combobox',{name:/^Estabelecimento/}).selectOption(B);
 await expect(page.getByRole('link',{name:'Abrir ficha de Aluno Fictício B'})).toBeVisible();await page.waitForTimeout(900);
 await expect(page.getByText('Aluno Fictício A',{exact:true})).toHaveCount(0);
 await expect(page.locator('.brandhead')).toContainText('Marca B');
});

test('foreign student lookup shows no assessment or personal data',async({page})=>{
 await fixture(page);await page.goto(`/alunos/00000000-0000-0000-0000-000000000999?org=${A}`);
 await expect(page.getByRole('status').filter({hasText:'Aluno indisponível'})).toBeVisible();await expect(page.getByRole('button',{name:'Guardar avaliação'})).toHaveCount(0);
 await expect(page.getByText('Aluno Fictício A',{exact:true})).toHaveCount(0);
});

test('archived profile is read only while retaining its history',async({page})=>{
 await fixture(page,{archived:true});await page.goto(`/alunos/${C}?org=${A}`);
 await page.getByRole('button',{name:'Avaliações',exact:true}).click();await expect(page.getByRole('heading',{name:'Histórico (1)'})).toBeVisible();await expect(page.getByRole('button',{name:'Guardar avaliação'})).toHaveCount(0);
 await expect(page.getByText(/histórico foi preservado/)).toBeVisible();
});

test('coach cannot edit branding or manage the team',async({page})=>{
 await fixture(page,{role:'coach'});await page.goto('/marca');await expect(page.getByLabel('Nome da marca')).toBeDisabled();await expect(page.getByRole('button',{name:'Guardar identidade'})).toBeDisabled();
 await page.goto('/equipa');await expect(page.getByRole('heading',{name:'Acesso reservado'})).toBeVisible();await expect(page.getByRole('button',{name:'Criar convite'})).toHaveCount(0);
});

test('white tenant colour uses readable black text in the preview',async({page})=>{
 await fixture(page);await page.goto('/marca');await expect(page.getByLabel('Cor principal')).toBeEnabled();await page.getByLabel('Cor principal').fill('#ffffff');
 await expect(page.locator('.brandmark')).toHaveCSS('color','rgb(0, 0, 0)');await expect(page.locator('.brandmark')).toHaveCSS('background-color','rgb(255, 255, 255)');
});

test('directory and six item navigation fit a small mobile viewport',async({page})=>{
 await page.setViewportSize({width:375,height:812});await fixture(page);await page.goto('/alunos');await expect(page.getByRole('link',{name:'Abrir ficha',exact:true})).toBeVisible();
 const size=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));expect(size.width).toBeLessThanOrEqual(size.viewport+2);
 await expect(page.getByRole('navigation',{name:'Navegação principal'}).getByRole('link')).toHaveCount(6);
});

test('signed-out professional routes never show records or privileged actions',async({page})=>{
 for(const path of ['/alunos','/equipa','/marca',`/alunos/${C}?org=${A}`]){
  await page.goto(path);await expect(page.getByRole('link',{name:'Iniciar sessão',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Guardar avaliação'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Criar convite'})).toHaveCount(0);
 }
});

test('revoking an invitation requires confirmation and cancellation leaves access unchanged',async({page})=>{
 const state=await fixture(page);await page.goto('/equipa');
 await expect(page.getByRole('button',{name:'Revogar',exact:true})).toBeEnabled();
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Revogar',exact:true}).click();expect(state.revocations()).toBe(0);
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Revogar',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Convite revogado'})).toContainText('Convite revogado');expect(state.revocations()).toBe(1);
 await expect(page.getByRole('button',{name:'Revogar',exact:true})).toHaveCount(0);
});
