const {test,expect}=require('@playwright/test');
const {fixture,A,C}=require('./fixtures.cjs');
test('commercial-only administrator cannot see measurements or follow-up sections',async({page})=>{
 await fixture(page,{restricted:true});await page.goto(`/alunos/${C}?org=${A}`);
 await expect(page.getByText('Medições reservadas aos profissionais autorizados.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Avaliações',exact:true})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Plano de acompanhamento'})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Privacidade e dados'})).toBeVisible();
});
test('read-only competency hides measurement writes while keeping history',async({page})=>{
 await fixture(page,{readOnly:true});await page.goto(`/alunos/${C}?org=${A}`);
 await page.getByRole('button',{name:'Avaliações',exact:true}).click();
 await expect(page.getByRole('button',{name:'Guardar avaliação',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Partilhar com aluno',exact:true})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Histórico (1)'})).toBeVisible();
});
test('explicit publication updates the current row',async({page})=>{
 await fixture(page);await page.goto(`/alunos/${C}?org=${A}`);await page.getByRole('button',{name:'Avaliações',exact:true}).click();
 await page.getByRole('button',{name:'Partilhar com aluno',exact:true}).click();
 await expect(page.getByRole('button',{name:'Retirar partilha',exact:true})).toBeVisible();
});
test('student invitation uses the separate acceptance endpoint and removes its token from URL',async({page})=>{
 await fixture(page);let accepted=false;
 await page.route('**/rest/v1/rpc/aura_student_invite_accept',route=>{accepted=true;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(C)});});
 await page.goto('/convite?aluno=1#'+'a'.repeat(64));
 await expect(page.getByRole('heading',{name:'Liga a tua conta ao acompanhamento.'})).toBeVisible();
 expect(new URL(page.url()).hash).toBe('');await page.getByRole('button',{name:'Aceitar convite'}).click();
 await expect(page.getByRole('link',{name:'Abrir a minha área →'})).toHaveAttribute('href','/aluno');expect(accepted).toBe(true);
});
test('student area renders own published projection and registers privacy request',async({page})=>{
 await fixture(page);let requested=false;
 await page.route('**/rest/v1/client_users**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{organization_id:A,client_id:C,clients:{full_name:'Aluno próprio fictício'}}])}));
 await page.route('**/rest/v1/rpc/aura_student_assessments',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:'shared-1',assessed_on:'2026-10-14',weight_kg:79,height_cm:null,waist_cm:null}])}));
 await page.route('**/rest/v1/rpc/aura_privacy_request_create',route=>{requested=route.request().postDataJSON().p_kind==='export';return route.fulfill({status:200,contentType:'application/json',body:'"request-synthetic"'});});
 await page.goto('/aluno');await expect(page.getByRole('heading',{name:'Aluno próprio fictício'})).toBeVisible();
 await expect(page.getByRole('cell',{name:'79',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Plano de acompanhamento'})).toHaveCount(0);
 await page.getByRole('button',{name:'Pedir exportação completa'}).click();await expect(page.getByRole('status').filter({hasText:'Registo guardado.'})).toBeVisible();expect(requested).toBe(true);
});
