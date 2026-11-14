const {test,expect}=require('@playwright/test');const {fixture,A,B,C,U,today}=require('./fixtures.cjs');
test.skip(process.env.NEXT_PUBLIC_AURA_PERSONAL_NUTRITION!=='1','Own-account local opt-in build only');
const D='00000000-0000-0000-0000-000000000200',reply=(r,data,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
async function setup(page,{conflict=false,uncertain=false,missing=false,two=false,delayed=false}={}){
 await fixture(page);let rows=[],saved=0,targetsSaved=0,targetReceipt=null,revoked=false;const targetVersions=[],mealVersions=[],targets=new Map();let release=()=>{};
 const key=(client,date)=>client+':'+date;
 const empty=(date)=>({targetDate:date,revision:0,targets:null});
 await page.route('**/rest/v1/client_users**',r=>reply(r,[{organization_id:A,client_id:C,clients:{full_name:'Conta própria fictícia A'}},...(two?[{organization_id:B,client_id:D,clients:{full_name:'Conta própria fictícia B'}}]:[])]));
 await page.route('**/rpc/aura_student_nutrition_context',r=>{if(revoked)return reply(r,{code:'42501'},403);return missing?reply(r,{code:'PGRST202'},404):reply(r,{canWrite:true});});
 await page.route('**/rpc/aura_student_nutrition_diary',r=>revoked?reply(r,{code:'42501'},403):reply(r,{meals:rows.filter(m=>m.consumedOn===r.request().postDataJSON().p_date),nextCursor:null}));
 await page.route('**/rpc/aura_student_nutrition_meal_save',r=>{const {p_command:c,p_client,p_org}=r.request().postDataJSON();expect(p_client).toBe(C);expect(p_org).toBe(A);saved++;const row={mealId:'00000000-0000-0000-0000-000000009100',revision:saved,consumedOn:c.consumedOn,mealKind:c.mealKind,status:'recorded',items:c.items};rows=[row];mealVersions.unshift(row);return reply(r,{mealId:row.mealId,revision:row.revision,replayed:false});});
 await page.route('**/rpc/aura_student_nutrition_history',r=>reply(r,{versions:mealVersions,nextCursor:null}));
 await page.route('**/rpc/aura_student_nutrition_targets_read',async r=>{const c=r.request().postDataJSON();if(revoked)return reply(r,{code:'42501'},403);if(delayed&&c.p_client===C){await new Promise(resolve=>{release=resolve;});return reply(r,{targetDate:c.p_date,revision:1,targets:{contractVersion:1,source:'manual',nutrients:{calories:1111,protein:90,carbs:null,fat:60}}});}return missing?reply(r,{code:'PGRST202'},404):reply(r,targets.get(key(c.p_client,c.p_date))||empty(c.p_date));});
 await page.route('**/rpc/aura_student_nutrition_targets_save',r=>{const {p_command:c,p_client,p_org}=r.request().postDataJSON();expect(p_client).toBe(C);expect(p_org).toBe(A);expect(c).not.toHaveProperty('actorId');targetsSaved++;const k=key(p_client,c.targetDate),old=targets.get(k)||empty(c.targetDate);
  if(conflict){conflict=false;targets.set(k,{targetDate:c.targetDate,revision:1,targets:{...c.targets,nutrients:{...c.targets.nutrients,calories:1900}}});return reply(r,{code:'PT409'},409);}
  if(old.revision!==c.expectedRevision)return reply(r,{code:'PT409'},409);
  const next={targetDate:c.targetDate,revision:c.expectedRevision+1,targets:c.targets};targets.set(k,next);targetVersions.unshift({...next,reason:c.reason});targetReceipt={targetDate:c.targetDate,revision:next.revision};return uncertain?r.abort('failed'):reply(r,{...targetReceipt,replayed:false});
 });
 await page.route('**/rpc/aura_student_nutrition_targets_request_status',r=>reply(r,targetReceipt));await page.route('**/rpc/aura_student_nutrition_targets_history',r=>reply(r,{versions:targetVersions,nextCursor:null}));
 await page.route('**/rest/v1/nutrition_capabilities**',()=>{throw Error('Student must not request staff nutrition capabilities');});
 await page.goto('/aluno');return {saved:()=>saved,targetsSaved:()=>targetsSaved,revoke:()=>{revoked=true;},restore:()=>{revoked=false;},release:()=>release()};
}
async function editTargets(page){const panel=page.getByRole('region',{name:'Referências privadas do dia'});await panel.getByText('Editar referências deste dia',{exact:true}).click();await panel.getByLabel('Referência de energia (kcal)',{exact:true}).fill('1800');await panel.getByLabel('Motivo da referência',{exact:true}).fill('Referência fictícia');return panel;}

test('student saves own manual references and diary without staff capabilities or invented consumption',async({page})=>{
 const s=await setup(page),panel=await editTargets(page);await panel.getByRole('button',{name:'Guardar referências',exact:true}).click();await expect(panel).toContainText('Guardado · versão 1');await expect(panel.getByRole('group',{name:'Balanço pelas referências guardadas'})).toContainText('Sem balanço completo');
 await page.getByLabel('Nome do alimento',{exact:true}).fill('Alimento privado fictício');await page.getByLabel('Energia (kcal) por 100 g',{exact:true}).fill('200');await page.getByRole('button',{name:'Guardar refeição',exact:true}).click();await expect(page.getByRole('cell',{name:/Alimento privado fictício.*200 kcal/})).toBeVisible();await expect(panel.getByRole('group',{name:'Balanço pelas referências guardadas'})).toContainText('1600');expect(s.saved()).toBe(1);expect(s.targetsSaved()).toBe(1);
 await panel.getByRole('button',{name:'Histórico das referências',exact:true}).click();await expect(panel.getByText('Versão 1 · Referência fictícia',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Privacidade',exact:true}).click();await expect(page.getByText('O exportador desta área ainda não inclui', {exact:false})).toBeVisible();await page.getByRole('button',{name:'Nutrição privada',exact:true}).click();await expect(panel).toContainText('Guardado · versão 1');
});
test('target conflict retains draft and requires explicit review before rebasing',async({page})=>{
 const s=await setup(page,{conflict:true}),panel=await editTargets(page);await panel.getByRole('button',{name:'Guardar referências',exact:true}).click();await expect(panel.getByLabel('Referência de energia (kcal)',{exact:true})).toHaveValue('1800');await expect(panel.getByRole('alert')).toContainText('1900');await expect(panel.getByRole('button',{name:'Guardar referências',exact:true})).toBeDisabled();
 await panel.getByRole('checkbox',{name:/Revi os valores guardados/}).check();await panel.getByRole('button',{name:'Guardar referências',exact:true}).click();await expect(panel).toContainText('Guardado · versão 2');expect(s.targetsSaved()).toBe(2);
});
test('uncertain target save blocks navigation and duplicate writes until receipt reconciliation',async({page})=>{
 const s=await setup(page,{uncertain:true}),panel=await editTargets(page);await panel.getByRole('button',{name:'Guardar referências',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('Resultado por confirmar');await expect(page.getByLabel('Dia do diário',{exact:true})).toBeDisabled();await expect(panel.getByRole('button',{name:'Guardar referências',exact:true})).toHaveCount(0);
 await panel.getByRole('button',{name:'Consultar recibo',exact:true}).click();await expect(panel).toContainText('Guardado · versão 1');expect(s.targetsSaved()).toBe(1);
});
test('student drafts survive tabs and cancelled route or logout navigation',async({page})=>{
 await setup(page);const panel=await editTargets(page);await page.getByRole('button',{name:'Medições',exact:true}).click();await page.getByRole('button',{name:'Nutrição privada',exact:true}).click();await expect(panel.getByLabel('Referência de energia (kcal)',{exact:true})).toHaveValue('1800');
 page.once('dialog',d=>d.dismiss());await page.getByRole('link',{name:'Conta',exact:true}).click();await expect(page).toHaveURL(/\/aluno$/);page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Terminar sessão',exact:true}).click();await expect(panel.getByLabel('Referência de energia (kcal)',{exact:true})).toHaveValue('1800');
});
test('cancelling a day change preserves unsaved individual references',async({page})=>{
 await setup(page);const panel=await editTargets(page);page.once('dialog',d=>d.dismiss());await page.getByLabel('Dia do diário',{exact:true}).fill('2000-01-01');await expect(page.getByLabel('Dia do diário',{exact:true})).toHaveValue(today);await expect(panel.getByLabel('Referência de energia (kcal)',{exact:true})).toHaveValue('1800');
});
test('late private target response from organization A never enters organization B',async({page})=>{
 const s=await setup(page,{two:true,delayed:true});await expect(page.getByRole('heading',{name:'Conta própria fictícia A'})).toBeVisible();await page.getByRole('combobox',{name:'Acompanhamento',exact:true}).selectOption(D);await expect(page.getByRole('heading',{name:'Conta própria fictícia B'})).toBeVisible();s.release();const panel=page.getByRole('region',{name:'Referências privadas do dia'});await expect(panel).toContainText('Sem referências guardadas neste dia.');await expect(panel).not.toContainText('1111');
});
test('revocation hides own targets and preserves draft through authorized refresh',async({page})=>{
 const s=await setup(page),panel=await editTargets(page);s.revoke();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(panel).toContainText('Sem acesso');await expect(panel.getByLabel('Referência de energia (kcal)',{exact:true})).toHaveCount(0);s.restore();await panel.getByRole('button',{name:'Atualizar referências',exact:true}).click();await expect(panel.getByLabel('Referência de energia (kcal)',{exact:true})).toHaveValue('1800');
});
for(const width of [320,1440])test(`own workspace remains readable and keyboard accessible at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await setup(page);const panel=await editTargets(page);await panel.getByRole('button',{name:'Guardar referências',exact:true}).click();await expect(panel).toContainText('Guardado · versão 1');await page.getByText('Planear quantidades e preparar um produto',{exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByLabel('Nome do produto',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});await page.screenshot({path:`.aura-integration/student-nutrition-${width}.png`,fullPage:true});
});
test('missing private RPCs stay unavailable without a demo or professional fallback',async({page})=>{
 await setup(page,{missing:true});await expect(page.getByRole('region',{name:'Nutrição persistente'})).toContainText('persistência nutricional ainda não está disponível');await expect(page.getByRole('button',{name:'Guardar refeição',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Guardar referências',exact:true})).toHaveCount(0);
});
