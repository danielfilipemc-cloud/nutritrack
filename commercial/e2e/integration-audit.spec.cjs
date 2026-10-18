const {test,expect}=require('@playwright/test');
const {fixture,A,B,C}=require('./fixtures.cjs');
async function directory(page){
 await fixture(page);let rows=[{id:C,organization_id:A,full_name:'Aluno Fictício A',revision:1,archived_at:null}];
 await page.route('**/rest/v1/clients?*',async route=>{
  if(route.request().method()!=='GET')return route.fallback();
  const data=new URL(route.request().url()).searchParams.get('organization_id')==='eq.'+A?rows:[];
  await route.fulfill({contentType:'application/json',headers:{'content-range':`0-${Math.max(0,data.length-1)}/${data.length}`,'access-control-expose-headers':'content-range'},body:JSON.stringify(data)});
 });
 await page.goto('/alunos');await expect(page.getByRole('link',{name:'Abrir ficha',exact:true})).toBeVisible();
 return {rows:()=>rows,replace:value=>rows=value};
}
test('directory creates, edits with revision and archives fictitious records',async({page})=>{
 const state=await directory(page);await page.route('**/rest/v1/clients',async route=>{const data=route.request().postDataJSON();expect(data.organization_id).toBe(A);state.replace([...state.rows(),{...data,id:'synthetic-new',revision:1,archived_at:null}]);await route.fulfill({status:201,body:''});});
 await page.locator('.aura-create-client>summary').click();await page.getByLabel('Nome',{exact:true}).fill('Novo aluno fictício');await page.getByRole('button',{name:'Registar aluno',exact:true}).click();await expect(page.getByRole('cell',{name:'Novo aluno fictício',exact:true})).toBeVisible();
 await page.route('**/rpc/aura_client_change',async route=>{const data=route.request().postDataJSON();expect(data.p_org).toBe(A);expect(data.p_revision).toBe(state.rows()[0].revision);state.replace(state.rows().map(c=>c.id===data.p_client?{...c,full_name:data.p_name,revision:c.revision+1,archived_at:data.p_archived?'2026-10-17':null}:c));await route.fulfill({contentType:'application/json',body:'null'});});
 const row=page.getByRole('row').filter({has:page.getByRole('cell',{name:'Aluno Fictício A',exact:true})});await row.getByLabel('Mais ações de Aluno Fictício A',{exact:true}).click();await row.getByRole('button',{name:'Editar',exact:true}).click();await page.getByLabel('Novo nome',{exact:true}).fill('Aluno fictício revisto');await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect(page.getByRole('cell',{name:'Aluno fictício revisto',exact:true})).toBeVisible();
 await page.getByLabel('Mais ações de Aluno fictício revisto',{exact:true}).click();page.once('dialog',d=>d.accept());await page.getByRole('row').filter({hasText:'Aluno fictício revisto'}).getByRole('button',{name:'Arquivar',exact:true}).click();await expect(page.getByRole('cell',{name:'Arquivado',exact:true})).toBeVisible();
});
test('directory conflict retains draft and blocks retries until explicit reload',async({page})=>{
 await directory(page);await page.route('**/rpc/aura_client_change',r=>r.fulfill({status:409,contentType:'application/json',body:JSON.stringify({code:'PT409'})}));await page.getByLabel('Mais ações de Aluno Fictício A',{exact:true}).click();await page.getByRole('button',{name:'Editar',exact:true}).click();const draft=page.getByLabel('Novo nome',{exact:true});await draft.fill('Rascunho em conflito');await page.getByRole('button',{name:'Guardar',exact:true}).click();await expect(draft).toHaveValue('Rascunho em conflito');await expect(page.getByRole('button',{name:'Guardar',exact:true})).toBeDisabled();
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Recarregar lista e descartar rascunho'}).click();await expect(draft).toHaveValue('Rascunho em conflito');page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Recarregar lista e descartar rascunho'}).click();await expect(draft).toHaveCount(0);await expect(page.getByRole('cell',{name:'Aluno Fictício A',exact:true})).toBeVisible();
});
test('directory creation draft survives cancelled tenant, filter, route and reload changes',async({page})=>{
 await directory(page);await page.locator('.aura-create-client>summary').click();const draft=page.getByLabel('Nome',{exact:true});await draft.fill('Rascunho fictício');
 for(const action of [()=>page.getByRole('combobox',{name:/^Estabelecimento/}).selectOption(B),()=>page.getByRole('combobox',{name:'Estado',exact:true}).selectOption('archived'),()=>page.getByRole('navigation',{name:'Navegação principal'}).getByRole('link',{name:'Agenda',exact:true}).click(),()=>page.reload({timeout:3000}).catch(()=>null)]){page.once('dialog',d=>d.dismiss());await action();await expect(draft).toHaveValue('Rascunho fictício');}
 await expect(page.getByRole('combobox',{name:/^Estabelecimento/})).toHaveValue(A);await expect(page.getByRole('combobox',{name:'Estado',exact:true})).toHaveValue('active');
});
test('directory pending creation blocks route and denied mutation preserves draft',async({page})=>{
 await directory(page);let release,started=false;const gate=new Promise(r=>release=r);await page.route('**/rest/v1/clients',async r=>{started=true;await gate;await r.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'42501'})});});
 await page.locator('.aura-create-client>summary').click();const draft=page.getByLabel('Nome',{exact:true});await draft.fill('Criação fictícia pendente');await page.getByRole('button',{name:'Registar aluno',exact:true}).click();await expect.poll(()=>started).toBe(true);await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('link',{name:'Agenda',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Aguarda a conclusão'})).toBeVisible();await page.getByRole('button',{name:'Terminar sessão',exact:true}).click();await expect(page.getByRole('button',{name:'Terminar sessão',exact:true})).toBeEnabled();release();await expect(draft).toHaveValue('Criação fictícia pendente');await expect(page.getByRole('button',{name:'Recarregar lista e descartar rascunho'})).toBeVisible();await expect(page.getByRole('button',{name:'Registar aluno',exact:true})).toBeDisabled();
});
test('directory history network failure exits loading without unhandled rejection',async({page})=>{
 await directory(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/rpc/aura_client_history',r=>r.abort('failed'));await page.getByLabel('Mais ações de Aluno Fictício A',{exact:true}).click();await page.getByRole('button',{name:'Histórico',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Não foi possível carregar o histórico'})).toBeVisible();await expect(page.getByText('A carregar histórico...', {exact:true})).toHaveCount(0);expect(errors).toEqual([]);
});
test('all eight modules keep a single establishment selector and contextual breadcrumbs',async({page})=>{
 await fixture(page);for(const [label,path] of [['Alunos','/alunos'],['Agenda','/agenda'],['Avaliações','/avaliacoes'],['Evolução','/evolucao'],['Equipa e convites','/equipa'],['A tua marca','/marca'],['Definições','/definicoes'],['Visão geral','/']]){
  const nav=page.getByRole('navigation',{name:'Navegação principal'});await nav.getByRole('link',{name:label,exact:true}).click();await expect(page).toHaveURL(new RegExp(path==='/'?'/$':path+'$'));await expect(page.getByRole('heading',{level:1})).toBeVisible();await expect(page.getByRole('combobox',{name:/^Estabelecimento/})).toHaveCount(1);await expect(page.getByRole('navigation',{name:'Localização'})).toBeVisible();await expect(nav.getByRole('link',{name:label,exact:true})).toHaveAttribute('aria-current','page');
 }
});
test('restricted evolution explains denied access without exposing measurements',async({page})=>{
 await fixture(page,{restricted:true});await page.goto(`/evolucao?org=${A}&aluno=${C}`);await expect(page.getByRole('heading',{name:'Sem acesso às medições',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Evolução do aluno',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Guardar avaliação',exact:true})).toHaveCount(0);
});
for(const kind of ['directory','assessment'])test(kind+' draft can cancel logout before Auth revocation',async({page})=>{
 if(kind==='directory'){await directory(page);await page.locator('.aura-create-client>summary').click();}else{await fixture(page);await page.goto(`/alunos/${C}?org=${A}&section=assessments`);}
 const draft=page.getByLabel(kind==='directory'?'Nome':'Peso (kg)',{exact:true});const value=kind==='directory'?'Rascunho fictício':'77.35';await draft.fill(value);let signouts=0;await page.route('**/auth/v1/logout*',async route=>{signouts++;await route.fallback();});page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Terminar sessão',exact:true}).click();await expect(draft).toHaveValue(value);expect(signouts).toBe(0);await expect(page.getByRole('button',{name:'Terminar sessão',exact:true})).toBeEnabled();
});
