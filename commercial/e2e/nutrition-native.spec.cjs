const {test,expect}=require('@playwright/test');const {fixture,A,C,U,today}=require('./fixtures.cjs');
test.skip(process.env.NEXT_PUBLIC_AURA_NATIVE_NUTRITION!=='1','Dedicated opt-in native build only');
const reply=(r,data,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
async function setup(page,{write=true,missing=false,uncertain=false,archived=false,noReceipt=false,waterUncertain=false,waterStall=false}={}){
 await fixture(page,{archived});let rows=[],saved=0,receipt=null,water=[],waterSaved=0,waterReceipt=null,documents=[],documentSaved=0,revoked=false;
 const history=new Map(),waterHistory=new Map(),documentHistory=new Map();
 let releaseWater=()=>{};
 await page.route('**/rest/v1/nutrition_capabilities?*',r=>{const q=new URL(r.request().url()).searchParams;expect(q.get('organization_id')).toBe('eq.'+A);expect(q.get('user_id')).toBe('eq.'+U);return reply(r,{can_write:write});});
 await page.route('**/rpc/aura_nutrition_diary',r=>missing?reply(r,{code:'PGRST202'},404):reply(r,{meals:rows,nextCursor:null}));
 await page.route('**/rpc/aura_nutrition_meal_save',r=>{const c=r.request().postDataJSON();expect(c.p_org).toBe(A);expect(c.p_client).toBe(C);expect(c.p_command).not.toHaveProperty('actorId');saved++;receipt={mealId:'00000000-0000-0000-0000-000000009000',revision:saved};const row={...receipt,consumedOn:today,mealKind:c.p_command.mealKind,status:c.p_command.operation==='void'?'voided':'recorded',items:c.p_command.operation==='void'?rows[0].items:c.p_command.items};rows=[row];history.set(row.mealId,[row,...(history.get(row.mealId)||[])]);return uncertain?r.abort('failed'):reply(r,{...receipt,replayed:false});});
 await page.route('**/rpc/aura_nutrition_request_status',r=>reply(r,noReceipt?null:receipt));
 await page.route('**/rpc/aura_nutrition_history',r=>reply(r,{versions:history.get(r.request().postDataJSON().p_meal)||[],nextCursor:null}));
 await page.route('**/rpc/aura_nutrition_water_diary',r=>revoked?reply(r,{code:'42501'},403):reply(r,{entries:water,nextCursor:null,summary:{activeCount:water.filter(e=>e.status==='recorded').length,voidedCount:water.filter(e=>e.status==='voided').length,declaredMl:water.some(e=>e.status==='recorded')?water.filter(e=>e.status==='recorded').reduce((s,e)=>s+e.entry.quantity.amount,0):null}}));
 await page.route('**/rpc/aura_nutrition_water_save',async r=>{
  if(revoked)return reply(r,{code:'42501'},403);
  const {p_org,p_client,p_command:c}=r.request().postDataJSON();expect(p_org).toBe(A);expect(p_client).toBe(C);expect(c).not.toHaveProperty('actorId');
  const previous=water.find(e=>e.waterId===c.waterId);if(c.expectedRevision!==(previous?.revision||0))return reply(r,{code:'PT409'},409);
  waterSaved++;waterReceipt={waterId:c.waterId||'00000000-0000-0000-0000-000000009010',revision:c.expectedRevision+1};
  const row={...waterReceipt,entry:c.entry||previous.entry,status:c.operation==='void'?'voided':'recorded',reason:c.reason,recordedBy:U};water=[row];waterHistory.set(row.waterId,[row,...(waterHistory.get(row.waterId)||[])]);
  if(waterStall){await new Promise(resolve=>{releaseWater=resolve;});try{return await reply(r,{...waterReceipt,replayed:false});}catch{return;}}
  return waterUncertain?r.abort('failed'):reply(r,{...waterReceipt,replayed:false});
 });
 await page.route('**/rpc/aura_nutrition_water_request_status',r=>reply(r,noReceipt?null:waterReceipt));
 await page.route('**/rpc/aura_nutrition_water_history',r=>reply(r,{versions:waterHistory.get(r.request().postDataJSON().p_water)||[],nextCursor:null}));
 await page.route('**/rpc/aura_nutrition_document_list',r=>revoked?reply(r,{code:'42501'},403):reply(r,{documents:documents.filter(d=>d.current.kind===r.request().postDataJSON().p_kind).sort((a,b)=>a.current.documentId.localeCompare(b.current.documentId)),nextCursor:null}));
 await page.route('**/rpc/aura_nutrition_document_save',r=>{
  if(revoked)return reply(r,{code:'42501'},403);
  const {p_org,p_client,p_command:c}=r.request().postDataJSON();expect(p_org).toBe(A);expect(p_client).toBe(C);expect(c).not.toHaveProperty('actorId');
  const previous=documents.find(d=>d.current.documentId===c.documentId);if(c.expectedRevision!==(previous?.current.revision||0))return reply(r,{code:'PT409'},409);
  documentSaved++;const documentId=c.documentId||`00000000-0000-0000-0000-${String(9020+documentSaved).padStart(12,'0')}`;
  const body=structuredClone(c.operation==='withdraw'?previous.published.body:c.body||previous.current.body);
  if(c.operation==='save'&&c.kind==='plan')for(const meal of body.meals){for(const d of [meal.primary,...meal.alternatives.map(a=>a.dish)])if(d.source==='recipe'){const source=documents.find(r=>r.published?.documentId===d.recipeId&&r.published.revision===d.revision);expect(source).toBeTruthy();d.snapshot=structuredClone(source.published.body);}}
  const current={documentId,kind:c.kind,revision:c.expectedRevision+1,status:c.operation==='save'?'draft':c.operation==='publish'?'published':'withdrawn',body,reason:c.reason,recordedBy:U};
  documents=documents.filter(d=>d.current.documentId!==documentId);documents.push({current,published:c.operation==='publish'?current:c.operation==='withdraw'?null:previous?.published||null});
  documentHistory.set(documentId,[current,...(documentHistory.get(documentId)||[])]);return reply(r,{documentId,revision:current.revision,replayed:false});
 });
 await page.route('**/rpc/aura_nutrition_document_history',r=>reply(r,{versions:documentHistory.get(r.request().postDataJSON().p_document)||[],nextCursor:null}));
 await page.goto(`/alunos/${C}?org=${A}&section=nutrition`);return {saved:()=>saved,waterSaved:()=>waterSaved,documentSaved:()=>documentSaved,releaseWater:()=>releaseWater(),revoke:()=>{revoked=true;},restore:()=>{revoked=false;},documents:()=>documents};
}
test('native diary saves a snapshot, reloads it and distinguishes unknown composition from zero',async({page})=>{
 const state=await setup(page);await page.getByLabel('Nome do alimento',{exact:true}).fill('Alimento fictício');await page.getByRole('button',{name:'Guardar refeição',exact:true}).click();await expect(page.getByRole('cell',{name:/Alimento fictício.*— kcal/})).toBeVisible();expect(state.saved()).toBe(1);await page.getByRole('button',{name:'Atualizar registos',exact:true}).click();await expect(page.getByRole('cell',{name:/Alimento fictício.*— kcal/})).toBeVisible();
});

async function openPlanning(page){const panel=page.getByRole('region',{name:'Planeamento e rótulos'});await panel.getByText('Planear quantidades e preparar um produto',{exact:true}).click();return panel;}
async function fillProduct(panel){await panel.getByLabel('Nome do produto',{exact:true}).fill('Produto inventado');await panel.getByLabel('Marca do produto (opcional)',{exact:true}).fill('Marca fictícia');await panel.getByLabel('Rótulo: energia por 100 g (kcal)',{exact:true}).fill('200');await panel.getByLabel('Rótulo: proteína por 100 g (g)',{exact:true}).fill('10');await panel.getByLabel('Rótulo: hidratos por 100 g (g)',{exact:true}).fill('30');await panel.getByLabel('Rótulo: gordura por 100 g (g)',{exact:true}).fill('5');await panel.getByLabel('Porção do produto (g)',{exact:true}).fill('150');}

test('branded label calculates a portion and adds a manual immutable snapshot only after explicit diary save',async({page})=>{
 const state=await setup(page),panel=await openPlanning(page);await fillProduct(panel);
 const preview=panel.getByRole('group',{name:'Composição da porção'});await expect(preview).toContainText('300');await expect(preview).toContainText('7,5');
 await panel.getByRole('button',{name:'Adicionar produto à refeição',exact:true}).click();expect(state.saved()).toBe(0);
 await expect(page.getByLabel('Nome do alimento',{exact:true})).toHaveValue('Produto inventado · Marca fictícia · como vendido');await expect(page.getByLabel('Quantidade (g)',{exact:true})).toHaveValue('150');
 await page.getByRole('button',{name:'Guardar refeição',exact:true}).click();await expect(page.getByRole('cell',{name:/Produto inventado.*Marca fictícia.*300 kcal/})).toBeVisible();expect(state.saved()).toBe(1);
 const disclosure=page.locator('details.aura-nutrition-reuse summary');await disclosure.focus();await page.keyboard.press('Enter');await page.getByRole('combobox',{name:'Alimento a reutilizar',exact:true}).selectOption('0');await expect(page.getByLabel('Nome do alimento',{exact:true})).toHaveValue('');await page.getByRole('button',{name:'Adicionar alimento selecionado',exact:true}).click();
 await expect(page.getByLabel('Nome do alimento',{exact:true})).toHaveValue('Produto inventado · Marca fictícia · como vendido');expect(state.saved()).toBe(1);
});

test('quantity solver is explicit and refuses unknown or zero label values',async({page})=>{
 await setup(page);const panel=await openPlanning(page);await fillProduct(panel);
 await panel.getByLabel('Quantidade pretendida de proteína (g)',{exact:true}).fill('25');await panel.getByRole('button',{name:'Calcular quantidade',exact:true}).click();await expect(panel.getByLabel('Porção do produto (g)',{exact:true})).toHaveValue('250');
 await panel.getByLabel('Rótulo: proteína por 100 g (g)',{exact:true}).fill('');await panel.getByRole('button',{name:'Calcular quantidade',exact:true}).click();await expect(panel.getByRole('status')).toContainText('não está disponível ou é zero');
 await expect(panel.getByRole('group',{name:'Composição da porção'})).toContainText('—');
});

test('manual references never turn an empty diary into zero consumption and survive a save or refresh',async({page})=>{
 const state=await setup(page),panel=await openPlanning(page);await panel.getByLabel('Meta de energia (kcal)',{exact:true}).fill('1800');
 const remaining=panel.getByRole('group',{name:'Diferença para as referências'});await expect(remaining).toContainText('Sem balanço completo');
 await fillProduct(panel);await panel.getByRole('button',{name:'Adicionar produto à refeição',exact:true}).click();await page.getByRole('button',{name:'Guardar refeição',exact:true}).click();
 await expect(panel.getByLabel('Meta de energia (kcal)',{exact:true})).toHaveValue('1800');await expect(remaining).toContainText('1500');
 await page.getByRole('button',{name:'Atualizar registos',exact:true}).click();await expect(panel.getByLabel('Meta de energia (kcal)',{exact:true})).toHaveValue('1800');expect(state.saved()).toBe(1);
});

test('mobile planning draft participates in the profile guard and stays usable at 320px',async({page})=>{
 await page.setViewportSize({width:320,height:900});await setup(page);const panel=await openPlanning(page);await fillProduct(panel);
 await panel.getByLabel('Meta de energia (kcal)',{exact:true}).fill('1800');
 page.once('dialog',d=>d.dismiss());await page.getByRole('combobox',{name:'Área da ficha',exact:true}).selectOption('overview');
 await expect(panel.getByLabel('Marca do produto (opcional)',{exact:true})).toHaveValue('Marca fictícia');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});await page.screenshot({path:'.aura-integration/nutrition-planning-320.png',fullPage:true});
});

test('read-only users do not receive product planning or adding controls',async({page})=>{
 await setup(page,{write:false});await expect(page.getByText('Sem edição disponível neste contexto.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Adicionar produto à refeição'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Calcular quantidade'})).toHaveCount(0);
});

test('finishing multiple diary pages never claims a consistent daily target balance',async({page})=>{
 await setup(page);const all=Array.from({length:21},(_,i)=>({mealId:`00000000-0000-0000-0000-${String(5000+i).padStart(12,'0')}`,revision:1,consumedOn:today,mealKind:'other',status:'recorded',items:[{label:'Exemplo paginado',source:'manual',quantity:{amount:100,unit:'g'},composition:{contractVersion:1,basis:{amount:100,unit:'g'},nutrients:{calories:10,protein:1,carbs:1,fat:0}}}]}));
 await page.route('**/rpc/aura_nutrition_diary',r=>reply(r,r.request().postDataJSON().p_after?{meals:all.slice(20),nextCursor:null}:{meals:all.slice(0,20),nextCursor:all[19].mealId}));
 await page.getByRole('button',{name:'Atualizar registos',exact:true}).click();const panel=await openPlanning(page);await panel.getByLabel('Meta de energia (kcal)',{exact:true}).fill('1800');
 await page.getByRole('button',{name:'Carregar mais registos',exact:true}).click();await expect(page.getByText('21 registos carregados', {exact:false})).toBeVisible();
 await expect(panel.getByRole('group',{name:'Diferença para as referências'})).toContainText('Sem balanço completo');
});

test('revocation hides planning controls and preserves its draft until authorized refresh',async({page})=>{
 await setup(page);const panel=await openPlanning(page);await fillProduct(panel);
 await page.route('**/rpc/aura_nutrition_diary',r=>reply(r,{code:'42501'},403));await page.getByRole('button',{name:'Atualizar registos',exact:true}).click();
 await expect(page.getByRole('region',{name:'Nutrição persistente'})).toContainText('Sem acesso a estes registos.');await expect(panel).toBeHidden();
 await page.route('**/rpc/aura_nutrition_diary',r=>reply(r,{meals:[],nextCursor:null}));await page.getByRole('button',{name:'Atualizar registos',exact:true}).click();
 await expect(panel.getByLabel('Marca do produto (opcional)',{exact:true})).toHaveValue('Marca fictícia');
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});await page.screenshot({path:'.aura-integration/nutrition-planning-desktop.png',fullPage:true});
});
test('read-only nutrition has no writing controls; missing RPC never falls back to invented meals',async({page})=>{
 await setup(page,{write:false});await expect(page.getByRole('region',{name:'Nutrição persistente'})).toContainText('Sem edição disponível');await expect(page.getByRole('button',{name:'Guardar refeição'})).toHaveCount(0);
});
test('missing nutrition installation is explicit and does not expose demo as saved data',async({page})=>{
 await setup(page,{missing:true});await expect(page.getByRole('region',{name:'Nutrição persistente'})).toContainText('persistência nutricional ainda não está disponível');await expect(page.getByRole('button',{name:'Guardar refeição'})).toHaveCount(0);await expect(page.getByText('Alimentos de exemplo')).toHaveCount(0);
});
test('archived students retain the diary but expose no nutrition writes',async({page})=>{
 await setup(page,{archived:true});await expect(page.getByRole('region',{name:'Nutrição persistente'})).toContainText('Sem edição disponível');await expect(page.getByRole('button',{name:'Guardar refeição'})).toHaveCount(0);
});
test('lost acknowledgement preserves draft, prevents duplicate save and resolves only through receipt',async({page})=>{
 const state=await setup(page,{uncertain:true});await page.getByLabel('Nome do alimento',{exact:true}).fill('Rascunho fictício');await page.getByRole('button',{name:'Guardar refeição',exact:true}).click();await expect(page.getByRole('region',{name:'Nutrição persistente'}).getByRole('alert')).toContainText('Resultado por confirmar');expect(state.saved()).toBe(1);await expect(page.getByRole('button',{name:'Guardar refeição'})).toHaveCount(0);await page.getByRole('button',{name:'Consultar recibo'}).click();await expect(page.getByRole('cell',{name:/Rascunho fictício/})).toBeVisible();expect(state.saved()).toBe(1);
});
test('cancelling section navigation preserves the native meal draft on mobile',async({page})=>{
 await page.setViewportSize({width:375,height:900});await setup(page);await page.getByLabel('Nome do alimento',{exact:true}).fill('Rascunho preservado');page.once('dialog',d=>d.dismiss());await page.getByRole('combobox',{name:'Área da ficha',exact:true}).selectOption('overview');await expect(page.getByLabel('Nome do alimento',{exact:true})).toHaveValue('Rascunho preservado');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'.aura-integration/native-nutrition-375.png',fullPage:true});
});

test('water create, correction, void and immutable history preserve unknown time and never imply zero',async({page})=>{
 const state=await setup(page);await page.getByRole('button',{name:'Água',exact:true}).click();const panel=page.getByRole('region',{name:'Água persistente'});
 await expect(panel).toContainText('Sem declarações ativas');await panel.getByLabel('Quantidade de água (ml)',{exact:true}).fill('350');await panel.getByRole('button',{name:'Guardar água',exact:true}).click();
 await expect(panel.getByRole('cell',{name:'Hora desconhecida'})).toBeVisible();await expect(panel).toContainText('350 ml');
 await panel.getByRole('button',{name:'Corrigir água',exact:true}).click();await panel.getByLabel('Quantidade de água (ml)',{exact:true}).fill('425');await panel.getByLabel('Motivo da alteração de água').fill('Correção fictícia');await panel.getByRole('button',{name:'Guardar água',exact:true}).click();
 await expect(panel).toContainText('425 ml');await panel.getByRole('button',{name:'Anular água',exact:true}).click();await panel.getByLabel('Motivo da alteração de água').fill('Anulação fictícia');page.once('dialog',d=>d.accept());await panel.getByRole('button',{name:'Confirmar anulação de água'}).click();await expect(panel).toContainText('Sem declarações ativas');
 await panel.getByRole('button',{name:'Histórico da água'}).click();await expect(panel).toContainText('Versão 1:');await expect(panel).toContainText('Versão 3:');expect(state.waterSaved()).toBe(3);
});

test('recipe publication, plan snapshot and withdrawal stay separate from diary consumption',async({page})=>{
 const state=await setup(page);await page.getByRole('button',{name:'Receitas e planos',exact:true}).click();const panel=page.getByRole('region',{name:'Documentos nutricionais'});
 await panel.getByText('Preparar receita',{exact:true}).click();await panel.getByLabel('Título do documento').fill('Receita inventada');await panel.getByLabel('Nome do alimento',{exact:true}).fill('Ingrediente inventado');await panel.getByRole('button',{name:'Guardar documento',exact:true}).click();await expect(panel).toContainText('Versão atual 1');
 await panel.getByRole('button',{name:'Preparar publicação'}).click();await panel.getByLabel('Motivo da versão').fill('Publicação fictícia');page.once('dialog',d=>d.accept());await panel.getByRole('button',{name:'Confirmar publicação',exact:true}).click();await expect(panel).toContainText('versão 2.');
 await panel.getByRole('button',{name:'Planos',exact:true}).click();await panel.getByText('Preparar plano',{exact:true}).click();await panel.getByLabel('Título do documento').fill('Plano manual inventado');await panel.getByLabel('Nome da refeição',{exact:true}).fill('Almoço inventado');await panel.getByLabel('Origem do prato').selectOption('recipe');await panel.getByLabel('Receita e versão publicada').selectOption({label:'Receita inventada · versão 2'});await panel.getByRole('button',{name:'Guardar documento',exact:true}).click();
 await expect(panel).toContainText('Plano manual inventado');await panel.getByText('Consultar conteúdo da versão 1',{exact:true}).click();await expect(panel).toContainText('receita versão 2 (composição congelada)');
 await panel.getByRole('button',{name:'Preparar publicação'}).click();await panel.getByLabel('Motivo da versão').fill('Publicar plano fictício');page.once('dialog',d=>d.accept());await panel.getByRole('button',{name:'Confirmar publicação',exact:true}).click();await expect(panel).toContainText('Versão atual 2');
 await panel.getByRole('button',{name:'Editar documento'}).click();await panel.getByLabel('Título do documento').fill('Novo rascunho pendente');await panel.getByLabel('Motivo da versão').fill('Rever o rascunho');await panel.getByRole('button',{name:'Guardar documento',exact:true}).click();await expect(panel).toContainText('Disponível: Plano manual inventado, versão 2.');
 await panel.getByRole('button',{name:'Preparar retirada'}).click();await panel.getByLabel('Motivo da versão').fill('Retirada fictícia');page.once('dialog',d=>d.accept());await panel.getByRole('button',{name:'Confirmar retirada',exact:true}).click();await expect(panel).toContainText('Versão atual 4');await expect(panel).toContainText('Sem publicação disponível.');
 await panel.getByRole('button',{name:'Histórico do documento'}).click();await expect(panel).toContainText('Versão 3: Novo rascunho pendente');await expect(panel).toContainText('Versão 4: Plano manual inventado');expect(state.documentSaved()).toBe(6);expect(state.saved()).toBe(0);expect(state.waterSaved()).toBe(0);
});

test('drafts survive module and recipe/plan changes; cancelling outer navigation retains them on mobile',async({page})=>{
 await page.setViewportSize({width:375,height:900});await setup(page);const meals=page.getByRole('region',{name:'Nutrição persistente'});await meals.getByLabel('Nome do alimento',{exact:true}).fill('Rascunho refeição');
 await page.getByRole('button',{name:'Água',exact:true}).click();const water=page.getByRole('region',{name:'Água persistente'});await water.getByLabel('Quantidade de água (ml)',{exact:true}).fill('500');
 await page.getByRole('button',{name:'Receitas e planos',exact:true}).click();const docs=page.getByRole('region',{name:'Documentos nutricionais'});await docs.getByText('Preparar receita',{exact:true}).click();await docs.getByLabel('Título do documento').fill('Receita em preparação');await docs.getByRole('button',{name:'Planos',exact:true}).click();await docs.getByText('Preparar plano',{exact:true}).click();await docs.getByLabel('Título do documento').fill('Plano em preparação');await docs.getByRole('button',{name:'Receitas',exact:true}).click();await expect(docs.getByLabel('Título do documento')).toHaveValue('Receita em preparação');
 page.once('dialog',d=>d.dismiss());await page.getByRole('combobox',{name:'Área da ficha',exact:true}).selectOption('overview');await expect(docs.getByLabel('Título do documento')).toHaveValue('Receita em preparação');await page.getByRole('button',{name:'Água',exact:true}).click();await expect(water.getByLabel('Quantidade de água (ml)',{exact:true})).toHaveValue('500');await page.getByRole('button',{name:'Refeições',exact:true}).click();await expect(meals.getByLabel('Nome do alimento',{exact:true})).toHaveValue('Rascunho refeição');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});

test('an uncertain water save cannot be repeated and leaving requires explicit acknowledgement plus draft confirmation',async({page})=>{
 const state=await setup(page,{waterUncertain:true,noReceipt:true});await page.getByRole('button',{name:'Água',exact:true}).click();const water=page.getByRole('region',{name:'Água persistente'});await water.getByLabel('Quantidade de água (ml)',{exact:true}).fill('300');await water.getByRole('button',{name:'Guardar água',exact:true}).click();await expect(water.getByRole('alert')).toContainText('Resultado por confirmar');await expect(page.getByRole('button',{name:'Refeições',exact:true})).toBeDisabled();await water.getByRole('button',{name:'Consultar recibo'}).click();await expect(water).toContainText('Ainda sem recibo');expect(state.waterSaved()).toBe(1);
 page.once('dialog',d=>d.dismiss());await water.getByRole('button',{name:'Permitir saída sem repetir'}).click();await expect(page.getByRole('button',{name:'Refeições',exact:true})).toBeDisabled();page.once('dialog',d=>d.accept());await water.getByRole('button',{name:'Permitir saída sem repetir'}).click();await page.getByRole('button',{name:'Refeições',exact:true}).click();page.once('dialog',d=>d.dismiss());await page.getByRole('link',{name:'Visão geral',exact:true}).first().click();await expect(page).toHaveURL(/section=nutrition/);expect(state.waterSaved()).toBe(1);
});

test('revoked water authorization removes data and write controls while retaining the draft for review',async({page})=>{
 const state=await setup(page);await page.getByRole('button',{name:'Água',exact:true}).click();const panel=page.getByRole('region',{name:'Água persistente'});await panel.getByLabel('Quantidade de água (ml)',{exact:true}).fill('250');state.revoke();await panel.getByRole('button',{name:'Guardar água',exact:true}).click();await expect(panel.getByRole('button',{name:'Guardar água',exact:true})).toHaveCount(0);expect(state.waterSaved()).toBe(0);await expect(panel).toContainText('Sem acesso a estes registos.');state.restore();await panel.getByRole('button',{name:'Atualizar água'}).click();await expect(panel.getByLabel('Quantidade de água (ml)',{exact:true})).toHaveValue('250');
});

test('document conflict preserves the draft and does not publish or replace it automatically',async({page})=>{
 const state=await setup(page);await page.getByRole('button',{name:'Receitas e planos',exact:true}).click();const panel=page.getByRole('region',{name:'Documentos nutricionais'});await panel.getByText('Preparar receita',{exact:true}).click();await panel.getByLabel('Título do documento').fill('Receita fictícia original');await panel.getByLabel('Nome do alimento',{exact:true}).fill('Alimento fictício');await panel.getByRole('button',{name:'Guardar documento',exact:true}).click();await panel.getByRole('button',{name:'Editar documento'}).click();await panel.getByLabel('Título do documento').fill('Rascunho em conflito');await panel.getByLabel('Motivo da versão').fill('Revisão fictícia');
 await page.route('**/rpc/aura_nutrition_document_save',r=>reply(r,{code:'PT409'},409));await panel.getByRole('button',{name:'Guardar documento',exact:true}).click();await expect(panel).toContainText('O registo foi alterado');await expect(panel.getByLabel('Título do documento')).toHaveValue('Rascunho em conflito');expect(state.documentSaved()).toBe(1);expect(state.documents()[0].published).toBeNull();
});

test('late capability response from a previous organization cannot restore nutrition data or editing controls',async({page})=>{
 const {B}=require('./fixtures.cjs');await setup(page);let release,started=false,delivered=false;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/rest/v1/nutrition_capabilities?*',async r=>{const org=new URL(r.request().url()).searchParams.get('organization_id');if(org!=='eq.'+A)return reply(r,null);started=true;await gate;try{await reply(r,{can_write:true});}finally{delivered=true;}});
 await page.getByRole('button',{name:'Água',exact:true}).click();await expect.poll(()=>started).toBe(true);await page.getByRole('combobox',{name:/^Estabelecimento/}).selectOption(B);await expect(page.getByRole('combobox',{name:/^Estabelecimento/})).toHaveValue(B);release();await expect.poll(()=>delivered).toBe(true);await expect(page.getByRole('region',{name:'Água persistente'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Guardar água',exact:true})).toHaveCount(0);await expect(page.getByRole('region',{name:'Nutrição persistente'})).toHaveCount(0);
});

test('native nutrition navigation and disclosures are keyboard discoverable with mobile layouts and visual evidence',async({page})=>{
 await setup(page);const nav=page.getByRole('navigation',{name:'Áreas da nutrição'});await nav.getByRole('button',{name:'Refeições',exact:true}).focus();await page.keyboard.press('Tab');await expect(nav.getByRole('button',{name:'Água',exact:true})).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByRole('region',{name:'Água persistente'})).toBeVisible();
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'.aura-integration/native-water-desktop.png',fullPage:true});
 await nav.getByRole('button',{name:'Receitas e planos',exact:true}).click();const panel=page.getByRole('region',{name:'Documentos nutricionais'});const summary=panel.locator('summary').filter({hasText:'Preparar receita'});await expect(summary).toBeVisible();await summary.focus();await page.keyboard.press('Enter');await expect(panel.getByLabel('Título do documento')).toBeVisible();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'.aura-integration/native-recipe-desktop.png',fullPage:true});
 for(const width of [375,320]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`.aura-integration/native-recipe-${width}.png`,fullPage:true});}
 await panel.getByRole('button',{name:'Planos',exact:true}).click();await panel.getByText('Preparar plano',{exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);expect((await panel.getByLabel('Nome do alimento',{exact:true}).boundingBox()).width).toBeGreaterThanOrEqual(190);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'.aura-integration/native-plan-320.png',fullPage:true});
});

test('read-only and archived nutrition never expose water or document mutation controls',async({page})=>{
 await setup(page,{archived:true});await page.getByRole('button',{name:'Água',exact:true}).click();await expect(page.getByRole('button',{name:'Guardar água',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Receitas e planos',exact:true}).click();await expect(page.getByText('Preparar receita',{exact:true})).toHaveCount(0);
});

test('a stalled accepted save stops waiting and recovers through its receipt without another mutation',async({page})=>{
 const state=await setup(page,{waterStall:true});await page.getByRole('button',{name:'Água',exact:true}).click();const panel=page.getByRole('region',{name:'Água persistente'});await panel.getByLabel('Quantidade de água (ml)',{exact:true}).fill('300');await panel.getByRole('button',{name:'Guardar água',exact:true}).click();
 try{await expect(panel.getByRole('alert')).toContainText('Resultado por confirmar',{timeout:12000});await expect(panel).toHaveAttribute('aria-busy','false');expect(state.waterSaved()).toBe(1);await expect(panel.getByRole('button',{name:'Guardar água',exact:true})).toHaveCount(0);await panel.getByRole('button',{name:'Consultar recibo'}).click();await expect(panel.getByRole('cell',{name:/300 ml/})).toBeVisible();expect(state.waterSaved()).toBe(1);}finally{state.releaseWater();}
});

test('a stalled capability lookup ends as unavailable and its late response cannot enable editing',async({page})=>{
 await setup(page);let release,delivered=false;const gate=new Promise(resolve=>{release=resolve;});await page.route('**/rest/v1/nutrition_capabilities?*',async r=>{await gate;try{await reply(r,{can_write:true});}catch{}finally{delivered=true;}});
 await page.getByRole('button',{name:'Água',exact:true}).click();const panel=page.getByRole('region',{name:'Água persistente'});try{await expect(panel).toHaveAttribute('aria-busy','false',{timeout:12000});await expect(panel).toContainText('persistência nutricional ainda não está disponível');await expect(panel.getByRole('button',{name:'Guardar água',exact:true})).toHaveCount(0);}finally{release();}await expect.poll(()=>delivered).toBe(true);await expect(panel.getByRole('button',{name:'Guardar água',exact:true})).toHaveCount(0);
});
