const {test,expect}=require('@playwright/test');const {fixture,A,B,C}=require('./fixtures.cjs');
const reply=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
const request={id:'privacy-one',kind:'erasure',status:'requested',revision:1};
async function open(page){await page.goto(`/alunos/${C}?org=${A}`);return page.getByRole('region',{name:'Privacidade e dados',exact:true});}
test('privacy network read failure recovers and does not leave an endless loading state',async({page})=>{
 await fixture(page);let fail=true;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/rpc/aura_privacy_context',r=>fail?r.abort('failed'):reply(r,{can_review:true,consents:[],requests:[]}));
 const panel=await open(page);await expect(panel.getByText('Dados indisponíveis.',{exact:true})).toBeVisible();await expect(panel.getByRole('button',{name:'Pedir eliminação'})).toBeDisabled();
 fail=false;await panel.getByRole('button',{name:'Tentar novamente'}).click();await expect(panel.getByText('Sem pedidos registados.')).toBeVisible();expect(errors).toEqual([]);
});
test('privacy conflict and uncertain writes preserve reference and require an explicit server reload',async({page})=>{
 await fixture(page);let calls=0;await page.route('**/rpc/aura_privacy_context',r=>reply(r,{can_review:true,consents:[],requests:[request]}));
 await page.route('**/rpc/aura_privacy_review',r=>{calls++;return calls===1?reply(r,{code:'PT409'},409):r.abort('failed');});
 const panel=await open(page),input=panel.getByLabel('Referência da revisão (sem dados sensíveis)');await input.fill('Synthetic draft preserved');await panel.getByRole('button',{name:'Marcar em análise'}).click();
 await expect(input).toHaveValue('Synthetic draft preserved');await expect(panel.getByRole('button',{name:'Marcar em análise'})).toBeDisabled();expect(calls).toBe(1);
 await panel.getByRole('button',{name:'Atualizar pedidos'}).click();await expect(panel.getByRole('button',{name:'Marcar em análise'})).toBeEnabled();await panel.getByRole('button',{name:'Marcar em análise'}).click();
 await expect(panel.getByRole('status')).toContainText(/não foi confirmado|não confirmada/);await expect(input).toHaveValue('Synthetic draft preserved');await expect(panel.getByRole('button',{name:'Marcar em análise'})).toBeDisabled();expect(calls).toBe(2);
});
test('privacy review history is minimal and a pending draft prevents silent section navigation on mobile',async({page})=>{
 await page.setViewportSize({width:375,height:812});await fixture(page);await page.route('**/rpc/aura_privacy_context',r=>reply(r,{can_review:true,consents:[],requests:[request]}));
 await page.route('**/rpc/aura_privacy_review_history',r=>reply(r,[{revision:2,status:'in_review',reference:'Synthetic audit reference'}]));
 const panel=await open(page);await panel.getByRole('button',{name:'Histórico de revisão',exact:true}).click();await expect(panel.getByText(/Synthetic audit reference/)).toBeVisible();
 await panel.getByLabel('Referência da revisão (sem dados sensíveis)').fill('Pending synthetic draft');page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Evolução',exact:true}).click();await expect(panel).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});
test('student switching accompaniment discards late private context without locking the new panel',async({page})=>{
 await fixture(page);const other='00000000-0000-0000-0000-000000000200';
 await page.route('**/rest/v1/client_users**',r=>reply(r,[{organization_id:A,client_id:C,clients:{full_name:'Synthetic A'}},{organization_id:B,client_id:other,clients:{full_name:'Synthetic B'}}]));
 await page.route('**/rpc/aura_student_assessments',r=>reply(r,[]));let complete;
 await page.route('**/rpc/aura_privacy_context',async r=>{if(r.request().postDataJSON().p_org===A){await new Promise(resolve=>complete=resolve);return reply(r,{can_review:false,consents:[],requests:[request]});}return reply(r,{can_review:false,consents:[],requests:[]});});
 await page.goto('/aluno');await expect(page.getByRole('combobox',{name:'Acompanhamento',exact:true})).toBeVisible();await page.getByRole('combobox',{name:'Acompanhamento',exact:true}).selectOption(other);await expect(page.getByText('Sem pedidos registados.')).toBeVisible();complete?.();
 await expect(page.getByRole('button',{name:'Pedir exportação completa'})).toBeEnabled();await expect(page.getByText(/Eliminação · Pedido registado/)).toHaveCount(0);
});

test('student switching during a pending mutation never applies the previous result to the new accompaniment',async({page})=>{
 await fixture(page);const other='00000000-0000-0000-0000-000000000200';
 await page.route('**/rest/v1/client_users**',r=>reply(r,[{organization_id:A,client_id:C,clients:{full_name:'Synthetic A'}},{organization_id:B,client_id:other,clients:{full_name:'Synthetic B'}}]));
 await page.route('**/rpc/aura_student_assessments',r=>reply(r,[]));await page.route('**/rpc/aura_privacy_context',r=>reply(r,{can_review:false,consents:[],requests:[]}));let complete;
 await page.route('**/rpc/aura_privacy_request_create',async r=>{expect(r.request().postDataJSON().p_org).toBe(A);await new Promise(resolve=>complete=resolve);return reply(r,'synthetic-request');});
 await page.goto('/aluno');const button=page.getByRole('button',{name:'Pedir exportação completa',exact:true});await expect(button).toBeEnabled();await button.click();await expect(button).toBeDisabled();
 await page.getByRole('combobox',{name:'Acompanhamento',exact:true}).selectOption(other);await expect(button).toBeEnabled();complete?.();await expect(page.getByRole('heading',{name:'Synthetic B',exact:true})).toBeVisible();await expect(page.getByText('Registo guardado.',{exact:true})).toHaveCount(0);
});
