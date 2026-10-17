const {test,expect}=require('@playwright/test');
const {fixture,A,C,today}=require('./fixtures.cjs');
async function open(page){
 await page.goto(`/alunos/${C}?org=${A}`);if(page.viewportSize().width<=900)await page.getByRole('combobox',{name:'Área da ficha',exact:true}).selectOption('objectives');else await page.getByRole('button',{name:'Objetivos',exact:true}).click();
 const region=page.getByRole('region',{name:'Objetivos de acompanhamento',exact:true});
 await expect(region.getByText(/^\d+ objetivos neste filtro\.$/)).toBeVisible();return region;
}

test('objectives create, edit, complete, explicitly reopen and cancel without deleting history',async({page})=>{
 const state=await fixture(page);const region=await open(page);
 await region.getByLabel('Título do objetivo',{exact:true}).fill('Rever consistência semanal');await region.getByLabel('Prazo do objetivo (opcional)',{exact:true}).fill(today);
 await region.getByRole('button',{name:'Criar objetivo',exact:true}).click();
 await expect(region.getByRole('heading',{name:'Rever consistência semanal',exact:true})).toBeVisible();
 await region.getByRole('button',{name:'Editar objetivo: Rever consistência semanal',exact:true}).click();
 await region.getByLabel('Título do objetivo',{exact:true}).fill('Rever consistência de presença');await region.getByRole('button',{name:'Guardar alterações do objetivo'}).click();
 await expect(region.getByRole('heading',{name:'Rever consistência de presença',exact:true})).toBeVisible();
 await region.getByRole('button',{name:'Concluir objetivo: Rever consistência de presença',exact:true}).click();
 await expect(region.getByText('Sem objetivos neste filtro.',{exact:true})).toBeVisible();
 await region.getByLabel('Estado dos objetivos').selectOption('completed');
 await expect(region.getByText(/Concluído em/)).toBeVisible();
 page.once('dialog',d=>d.accept());await region.getByRole('button',{name:'Reabrir objetivo: Rever consistência de presença',exact:true}).click();
 await expect(region.getByLabel('Estado dos objetivos')).toHaveValue('active');await expect(region.getByRole('heading',{name:'Rever consistência de presença',exact:true})).toBeVisible();
 page.once('dialog',d=>d.accept());await region.getByRole('button',{name:'Cancelar objetivo: Rever consistência de presença',exact:true}).click();
 await expect(region.getByText('Sem objetivos neste filtro.',{exact:true})).toBeVisible();await region.getByLabel('Estado dos objetivos').selectOption('cancelled');
 await expect(region.getByRole('heading',{name:'Rever consistência de presença',exact:true})).toBeVisible();
 await region.getByText('Histórico dos objetivos',{exact:true}).click();await expect(region.getByText(/Objetivo reaberto/)).toBeVisible();await expect(region.getByText(/Objetivo cancelado/)).toBeVisible();
 expect(state.objectives()).toHaveLength(1);expect(state.objectives()[0].revision).toBe(5);
});

test('new objectives created from a closed filter return to their active list',async({page})=>{
 await fixture(page);const region=await open(page);await region.getByLabel('Estado dos objetivos').selectOption('completed');
 await region.getByLabel('Título do objetivo',{exact:true}).fill('Novo objetivo visível');await region.getByRole('button',{name:'Criar objetivo',exact:true}).click();
 await expect(region.getByLabel('Estado dos objetivos')).toHaveValue('active');await expect(region.getByRole('heading',{name:'Novo objetivo visível',exact:true})).toBeVisible();
});

test('an unconfirmed write preserves its draft and blocks blind retries until refresh',async({page})=>{
 await fixture(page);let failed=false;
 await page.route('**/rest/v1/rpc/aura_objective_save',route=>{if(!failed){failed=true;return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({code:'XX000',message:'Synthetic unconfirmed write'})});}return route.fallback();});
 const region=await open(page);await region.getByLabel('Título do objetivo',{exact:true}).fill('Resultado por confirmar');await region.getByRole('button',{name:'Criar objetivo',exact:true}).click();
 await expect(region.getByRole('alert')).toContainText('O pedido pode ter sido guardado');await expect(region.getByLabel('Título do objetivo',{exact:true})).toHaveValue('Resultado por confirmar');await expect(region.getByRole('button',{name:'Criar objetivo',exact:true})).toBeDisabled();
 page.once('dialog',d=>d.accept());await region.getByRole('button',{name:'Atualizar objetivos'}).click();await expect(region.getByText('Sem objetivos neste filtro.',{exact:true})).toBeVisible();
 await region.getByLabel('Título do objetivo',{exact:true}).fill('Nova tentativa verificada');await region.getByRole('button',{name:'Criar objetivo',exact:true}).click();await expect(region.getByRole('heading',{name:'Nova tentativa verificada',exact:true})).toBeVisible();
});

test('objective conflict preserves the draft and requires explicit reload',async({page})=>{
 await fixture(page,{seedObjectives:1,objectiveConflict:true});const region=await open(page);
 await region.getByRole('button',{name:'Editar objetivo: Objetivo fictício 1',exact:true}).click();
 await region.getByLabel('Título do objetivo',{exact:true}).fill('Rascunho preservado');await region.getByRole('button',{name:'Guardar alterações do objetivo'}).click();
 await expect(region.getByRole('alert')).toContainText('rascunho foi conservado');await expect(region.getByLabel('Título do objetivo',{exact:true})).toHaveValue('Rascunho preservado');
 await expect(region.getByRole('button',{name:'Guardar alterações do objetivo'})).toBeDisabled();
 page.once('dialog',d=>d.dismiss());await region.getByRole('button',{name:'Atualizar objetivos'}).click();await expect(region.getByLabel('Título do objetivo',{exact:true})).toHaveValue('Rascunho preservado');
 page.once('dialog',d=>d.accept());await region.getByRole('button',{name:'Atualizar objetivos'}).click();await expect(region.getByRole('heading',{name:'Objetivo alterado noutro pedido',exact:true})).toBeVisible();
 await expect(region.getByLabel('Título do objetivo',{exact:true})).toHaveValue('');await expect(region.getByRole('button',{name:'Criar objetivo'})).toBeEnabled();
});

test('read-only and archived profiles retain objective consultation without mutations',async({page})=>{
 await fixture(page,{seedObjectives:1,readOnly:true});let region=await open(page);
 await expect(region.getByRole('heading',{name:'Objetivo fictício 1',exact:true})).toBeVisible();await expect(region.getByRole('button',{name:'Criar objetivo'})).toHaveCount(0);await expect(region.getByRole('button',{name:/Concluir objetivo:/})).toHaveCount(0);
 await page.evaluate(()=>localStorage.clear());await page.unrouteAll();await fixture(page,{seedObjectives:1,archived:true});region=await open(page);
 await expect(region.getByText('Aluno arquivado: objetivos apenas para consulta.',{exact:true})).toBeVisible();await expect(region.getByRole('button',{name:/Editar objetivo:/})).toHaveCount(0);
});

test('commercial-only access does not offer the objective section',async({page})=>{
 await fixture(page,{restricted:true,seedObjectives:1});await page.goto(`/alunos/${C}?org=${A}`);
 await expect(page.getByRole('button',{name:'Resumo',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Objetivos',exact:true})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Objetivo fictício 1',exact:true})).toHaveCount(0);
});

test('objectives paginate and fit a mobile viewport',async({page})=>{
 await page.setViewportSize({width:375,height:812});await fixture(page,{seedObjectives:26});const region=await open(page);
 await expect(region.getByText('26 objetivos neste filtro.',{exact:true})).toBeVisible();await region.getByRole('button',{name:'Mais objetivos',exact:true}).click();
 await expect(region.getByRole('heading',{name:'Objetivo fictício 26',exact:true})).toBeVisible();await expect(region.getByRole('button',{name:'Mais objetivos',exact:true})).toBeDisabled();
 await region.getByRole('button',{name:'Objetivos anteriores',exact:true}).click();await expect(region.getByRole('heading',{name:'Objetivo fictício 1',exact:true})).toBeVisible();
 const width=await page.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:innerWidth}));expect(width.content).toBeLessThanOrEqual(width.viewport+2);
});

test('a pending objective draft cannot disappear silently when leaving the profile section',async({page})=>{
 const state=await fixture(page);const region=await open(page);await region.getByLabel('Título do objetivo',{exact:true}).fill('Objetivo ainda não guardado');
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Avaliações',exact:true}).click();await expect(region.getByLabel('Título do objetivo',{exact:true})).toHaveValue('Objetivo ainda não guardado');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Avaliações',exact:true}).click();await expect(region).toHaveCount(0);
 expect(state.objectives()).toHaveLength(0);
});
