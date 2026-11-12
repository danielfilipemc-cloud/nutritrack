const {test,expect}=require('@playwright/test');const {fixture,A,C,U,today}=require('./fixtures.cjs');
test.skip(process.env.NEXT_PUBLIC_AURA_NATIVE_NUTRITION!=='1','Dedicated opt-in native build only');
const reply=(r,data,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
async function setup(page,{write=true,missing=false,uncertain=false}={}){
 await fixture(page);let rows=[],saved=0,receipt=null;
 await page.route('**/rest/v1/nutrition_capabilities?*',r=>{const q=new URL(r.request().url()).searchParams;expect(q.get('organization_id')).toBe('eq.'+A);expect(q.get('user_id')).toBe('eq.'+U);return reply(r,{can_write:write});});
 await page.route('**/rpc/aura_nutrition_diary',r=>missing?reply(r,{code:'PGRST202'},404):reply(r,{meals:rows,nextCursor:null}));
 await page.route('**/rpc/aura_nutrition_meal_save',r=>{const c=r.request().postDataJSON();expect(c.p_org).toBe(A);expect(c.p_client).toBe(C);expect(c.p_command).not.toHaveProperty('actorId');saved++;receipt={mealId:'00000000-0000-0000-0000-000000009000',revision:saved};rows=[{...receipt,consumedOn:today,mealKind:c.p_command.mealKind,status:c.p_command.operation==='void'?'voided':'recorded',items:c.p_command.items}];return uncertain?r.abort('failed'):reply(r,{...receipt,replayed:false});});
 await page.route('**/rpc/aura_nutrition_request_status',r=>reply(r,receipt));
 await page.goto(`/alunos/${C}?org=${A}&section=nutrition`);return {saved:()=>saved};
}
test('native diary saves a snapshot, reloads it and distinguishes unknown composition from zero',async({page})=>{
 const state=await setup(page);await page.getByLabel('Nome do alimento',{exact:true}).fill('Alimento fictício');await page.getByRole('button',{name:'Guardar refeição',exact:true}).click();await expect(page.getByRole('cell',{name:/Alimento fictício.*— kcal/})).toBeVisible();expect(state.saved()).toBe(1);await page.getByRole('button',{name:'Atualizar registos',exact:true}).click();await expect(page.getByRole('cell',{name:/Alimento fictício.*— kcal/})).toBeVisible();
});
test('read-only nutrition has no writing controls; missing RPC never falls back to invented meals',async({page})=>{
 await setup(page,{write:false});await expect(page.getByRole('region',{name:'Nutrição persistente'})).toContainText('Sem edição disponível');await expect(page.getByRole('button',{name:'Guardar refeição'})).toHaveCount(0);
});
test('missing nutrition installation is explicit and does not expose demo as saved data',async({page})=>{
 await setup(page,{missing:true});await expect(page.getByRole('region',{name:'Nutrição persistente'})).toContainText('persistência nutricional ainda não está disponível');await expect(page.getByRole('button',{name:'Guardar refeição'})).toHaveCount(0);await expect(page.getByText('Alimentos de exemplo')).toHaveCount(0);
});
test('lost acknowledgement preserves draft, prevents duplicate save and resolves only through receipt',async({page})=>{
 const state=await setup(page,{uncertain:true});await page.getByLabel('Nome do alimento',{exact:true}).fill('Rascunho fictício');await page.getByRole('button',{name:'Guardar refeição',exact:true}).click();await expect(page.getByRole('region',{name:'Nutrição persistente'}).getByRole('alert')).toContainText('Resultado por confirmar');expect(state.saved()).toBe(1);await expect(page.getByRole('button',{name:'Guardar refeição'})).toHaveCount(0);await page.getByRole('button',{name:'Consultar recibo'}).click();await expect(page.getByRole('cell',{name:/Rascunho fictício/})).toBeVisible();expect(state.saved()).toBe(1);
});
test('cancelling section navigation preserves the native meal draft on mobile',async({page})=>{
 await page.setViewportSize({width:375,height:900});await setup(page);await page.getByLabel('Nome do alimento',{exact:true}).fill('Rascunho preservado');page.once('dialog',d=>d.dismiss());await page.getByRole('combobox',{name:'Área da ficha',exact:true}).selectOption('overview');await expect(page.getByLabel('Nome do alimento',{exact:true})).toHaveValue('Rascunho preservado');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);await page.screenshot({path:'.aura-integration/native-nutrition-375.png',fullPage:true});
});
