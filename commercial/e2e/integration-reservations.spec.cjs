const {test,expect}=require('@playwright/test');const {fixture,A,B,C,today}=require('./fixtures.cjs');
const url=section=>`/alunos/${C}?org=${A}&section=${section}`;
const cases=[['assessment','assessments','Peso (kg)','Guardar avaliação','aura_assessment_create'],['care','overview','Objetivo do acompanhamento','Guardar acompanhamento','aura_followup_save'],['objective','objectives','Título do objetivo','Criar objetivo','aura_objective_save'],['privacy','overview','Referência da revisão (sem dados sensíveis)','Marcar em análise','aura_privacy_review'],['bridge','integrations','Identificador da pessoa na origem','Confirmar associação NutriTrack','aura_nutritrack_link_save']];
async function prepare(page,entry){await fixture(page);if(entry[0]==='privacy')await page.route('**/rpc/aura_privacy_context',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({can_review:true,consents:[],requests:[{id:'synthetic-request',kind:'erasure',status:'requested',revision:1}]})}));await page.goto(url(entry[1]));const input=entry[0]==='care'?page.getByRole('textbox',{name:entry[2],exact:true}):page.getByLabel(entry[2],{exact:true});await input.fill(entry[0]==='assessment'?'77.35':'Synthetic preserved draft');return input;}
for(const entry of cases){
 test(entry[0]+' draft survives cancelled route, back, reload and close',async({page})=>{
  const input=await prepare(page,entry),original=page.url();
  page.once('dialog',d=>d.dismiss());await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('link',{name:'Agenda',exact:true}).click();await expect(page).toHaveURL(original);await expect(input).toHaveValue(entry[0]==='assessment'?'77.35':'Synthetic preserved draft');
  page.once('dialog',d=>d.dismiss());await page.goBack({timeout:3000}).catch(()=>null);await expect(page).toHaveURL(original);
  page.once('dialog',d=>d.dismiss());await page.reload({timeout:3000}).catch(()=>null);await expect(input).toHaveValue(entry[0]==='assessment'?'77.35':'Synthetic preserved draft');
  const dialog=page.waitForEvent('dialog');await page.close({runBeforeUnload:true});await (await dialog).dismiss();expect(page.isClosed()).toBe(false);
 });
 test(entry[0]+' pending mutation blocks route and section changes, and denied write retains draft',async({page})=>{
  const input=await prepare(page,entry);let release,started=false;const gate=new Promise(r=>release=r);await page.route('**/rpc/'+entry[4],async r=>{started=true;await gate;await r.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'42501'})});});
  await page.getByRole('button',{name:entry[3],exact:true}).click();await expect.poll(()=>started).toBe(true);await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('link',{name:'Agenda',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Aguarda a conclusão'})).toBeVisible();
  if(entry[0]!=='assessment')await page.getByRole('button',{name:'Avaliações',exact:true}).click();const response=page.waitForResponse(r=>r.url().endsWith('/rpc/'+entry[4]));release();await response;if(entry[0]==='privacy')await page.getByRole('region',{name:'Privacidade e dados'}).getByRole('button',{name:'Tentar novamente',exact:true}).click();await expect(input).toHaveValue(entry[0]==='assessment'?'77.35':'Synthetic preserved draft');
 });
}

test('late permission response from A cannot populate B or enable previous edit controls',async({page})=>{
 await fixture(page);const other='00000000-0000-0000-0000-000000000200';await page.route('**/rest/v1/clients?*',r=>new URL(r.request().url()).searchParams.get('organization_id')==='eq.'+B?r.fulfill({contentType:'application/json',headers:{'content-range':'0-0/1'},body:JSON.stringify([{id:other,organization_id:B,full_name:'Synthetic B',archived_at:null}])}):r.fallback());await page.route('**/rest/v1/assessments?*',r=>new URL(r.request().url()).searchParams.get('organization_id')==='eq.'+B?r.fulfill({contentType:'application/json',headers:{'content-range':'*/0'},body:'[]'}):r.fallback());await page.goto('/avaliacoes?org='+A);let release,started=false;const gate=new Promise(r=>release=r);
 await page.route('**/rpc/aura_client_permissions',async r=>{const org=r.request().postDataJSON().p_org;if(org===A){started=true;await gate;return r.fulfill({contentType:'application/json',body:JSON.stringify({assessments_read:true,assessments_write:true,followup_read:true,followup_write:true,schedule_read:true,schedule_write:true})});}return r.fulfill({contentType:'application/json',body:JSON.stringify({assessments_read:true,assessments_write:false,followup_read:false,schedule_read:false})});});
 await page.getByRole('combobox',{name:'Aluno',exact:true}).selectOption(C);await expect.poll(()=>started).toBe(true);await page.getByRole('combobox',{name:/^Estabelecimento/}).selectOption(B);
 await page.getByRole('combobox',{name:'Aluno',exact:true}).selectOption(other);await expect(page.getByText('Permissão de consulta; registo e correção exigem competência de escrita.')).toBeVisible();const old=page.waitForResponse(r=>r.url().endsWith('/rpc/aura_client_permissions')&&r.request().postDataJSON().p_org===A);release();await old;await expect(page.getByRole('combobox',{name:/^Estabelecimento/})).toHaveValue(B);await expect(page.getByRole('button',{name:'Guardar avaliação'})).toHaveCount(0);await expect(page.getByText('Aluno Fictício A',{exact:true})).toHaveCount(0);
});

test('revocation before delayed assessments arrive discards the response and hides editors',async({page})=>{
 await fixture(page);let revoked=false,release,started=false;const gate=new Promise(r=>release=r);
 await page.route('**/rpc/aura_client_permissions',r=>revoked?r.fulfill({contentType:'application/json',body:JSON.stringify({assessments_read:false,assessments_write:false})}):r.fallback());
 await page.route('**/rest/v1/assessments?*',async r=>{started=true;await gate;await r.fallback();});await page.goto(url('assessments'));await expect.poll(()=>started).toBe(true);revoked=true;release();
 await expect(page.getByRole('status').filter({hasText:'As permissões mudaram'})).toBeVisible();await expect(page.getByRole('button',{name:'Guardar avaliação'})).toHaveCount(0);await expect(page.getByRole('heading',{name:'Histórico (1)'})).toHaveCount(0);
});

test('correction and assessment drafts cannot be lost by history pagination',async({page})=>{
 await fixture(page);await page.route('**/rest/v1/assessments?*',r=>r.fulfill({contentType:'application/json',headers:{'content-range':'0-0/30','access-control-expose-headers':'content-range'},body:JSON.stringify([{id:'synthetic-version',assessed_on:today,weight_kg:80,height_cm:null,waist_cm:null,revision:2,student_visible:false,superseded_at:null}])}));await page.goto(url('assessments'));
 await page.getByText('Corrigir medição',{exact:true}).click();await page.getByLabel('Motivo da correção',{exact:true}).fill('Synthetic correction draft');const section=page.locator('section').filter({has:page.getByRole('heading',{name:'Histórico (30)',exact:true})});
 page.once('dialog',d=>d.dismiss());await section.getByRole('button',{name:'Seguinte',exact:true}).click();await expect(page.getByLabel('Motivo da correção',{exact:true})).toHaveValue('Synthetic correction draft');await expect(section).toContainText('Página 1 de 2');
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Evolução',exact:true}).click();await expect(page.getByLabel('Motivo da correção',{exact:true})).toHaveValue('Synthetic correction draft');
});

test('same-document browser back cancellation preserves the objective draft',async({page})=>{
 await fixture(page);await page.goto(url('objectives'));await page.evaluate(()=>history.pushState(history.state,'',location.href+'&navigation-test=1'));await page.getByLabel('Título do objetivo',{exact:true}).fill('Synthetic same document draft');const here=page.url();
 page.once('dialog',d=>d.dismiss());await page.goBack({timeout:3000}).catch(()=>null);await expect(page).toHaveURL(here);await expect(page.getByLabel('Título do objetivo',{exact:true})).toHaveValue('Synthetic same document draft');
});

test('explicit discard permits navigation with only one confirmation',async({page})=>{
 await prepare(page,cases[2]);let prompts=0;page.on('dialog',async d=>{prompts++;await d.accept();});await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('link',{name:'Agenda',exact:true}).click();await expect(page).toHaveURL(/\/agenda$/);expect(prompts).toBe(1);
});

test('partial assessment revocation preserves a still-authorized followup draft',async({page})=>{
 await fixture(page);let revoked=false,release,started=false;const gate=new Promise(r=>release=r);
 await page.route('**/rpc/aura_client_permissions',r=>revoked?r.fulfill({contentType:'application/json',body:JSON.stringify({assessments_read:false,assessments_write:false,followup_read:true,followup_write:true,schedule_read:true,schedule_write:true})}):r.fallback());
 await page.route('**/rest/v1/assessments?*',async r=>{started=true;await gate;await r.fallback();});await page.goto(url('overview'));await expect.poll(()=>started).toBe(true);
 const draft=page.getByRole('textbox',{name:'Objetivo do acompanhamento',exact:true});await draft.fill('Synthetic still-authorized followup');revoked=true;release();
 await expect(page.getByRole('status').filter({hasText:'As permissões mudaram'})).toBeVisible();await expect(draft).toHaveValue('Synthetic still-authorized followup');await expect(page.getByRole('button',{name:'Guardar acompanhamento',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'Avaliações',exact:true})).toHaveCount(0);
});
