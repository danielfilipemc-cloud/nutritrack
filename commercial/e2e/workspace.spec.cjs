const {test,expect}=require('@playwright/test');
const A='00000000-0000-0000-0000-000000000010',B='00000000-0000-0000-0000-000000000020';
const C='00000000-0000-0000-0000-000000000100',U='00000000-0000-0000-0000-000000000001';
const today=new Date().toISOString().slice(0,10);

// Browser contract tests only. All Supabase requests are intercepted; RLS is tested in PostgreSQL.
async function fixture(page,{role='owner',dashboardError=false,slowA=false,archived=false}={}){
 let failures=dashboardError?1:0,calls=0,revocations=0;
 const user={id:U,aud:'authenticated',role:'authenticated',email:'fictional@example.invalid',email_confirmed_at:today,app_metadata:{provider:'email'},user_metadata:{},created_at:today};
 const jwt=[{alg:'HS256',typ:'JWT'},{sub:U,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'fixture'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
 const client={id:C,organization_id:A,full_name:'Aluno Fictício A',created_at:today,updated_at:today,archived_at:archived?today:null,revision:1};
 const assessments=[{id:'measurement-1',assessed_on:today,weight_kg:80,height_cm:175,waist_cm:null}];
 await page.route('https://*.supabase.co/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname;
  const respond=(body,status=200,extra={})=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range',...extra},body:JSON.stringify(body)});
  if(request.method()==='OPTIONS')return respond({});
  if(path.endsWith('/auth/v1/token'))return respond({access_token:jwt,refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user});
  if(path.endsWith('/auth/v1/user'))return respond(user);
  if(path.endsWith('/auth/v1/logout'))return respond({});
  if(path.endsWith('/organization_members'))return respond([{role,organizations:{id:A,name:'Estúdio Fictício A'}},{role:'owner',organizations:{id:B,name:'Estúdio Fictício B'}}]);
  if(path.endsWith('/organization_branding'))return respond({display_name:url.searchParams.get('organization_id')==='eq.'+B?'Marca B':'Marca A',primary_color:'#137F79',logo_url:null});
  if(path.endsWith('/rpc/aura_dashboard')){
   calls++;const org=request.postDataJSON().p_org;if(failures-->0)return respond({message:'fixture error',code:'XX000'},500);
   if(slowA&&org===A)await new Promise(resolve=>setTimeout(resolve,700));
   return respond({as_of:today,active_clients:org===A?7:2,archived_clients:1,assessments_30_days:3,pending_clients:1,
    pending:[{id:C,full_name:org===A?'Aluno Fictício A':'Aluno Fictício B',assessed_on:null}],recent:[]});
  }
  if(path.endsWith('/rpc/aura_team_list'))return respond([{user_id:U,email:user.email,role:'owner',joined_at:today}]);
  if(path.endsWith('/rpc/aura_invitation_list'))return respond([{id:'00000000-0000-0000-0000-000000000300',email:'invite@example.invalid',role:'coach',status:revocations?'revoked':'pending',expires_at:today}]);
  if(path.endsWith('/rpc/aura_invitation_revoke')){revocations++;return respond(null);}
  if(path.endsWith('/clients')){
   const matches=(!url.searchParams.get('id')||url.searchParams.get('id')==='eq.'+C)&&url.searchParams.get('organization_id')==='eq.'+A;
   const rows=matches?[client]:[];
   if(request.headers().accept?.includes('vnd.pgrst.object'))return respond(rows[0]||null);
   return respond(rows,200,{'content-range':rows.length?'0-0/1':'*/0'});
  }
  if(path.endsWith('/assessments')){
   if(request.method()==='POST'){const input=request.postDataJSON();assessments.unshift({id:'measurement-2',assessed_on:input.assessed_on,weight_kg:input.weight_kg,height_cm:input.height_cm,waist_cm:input.waist_cm});return respond(null,201);}
   return respond(assessments,200,{'content-range':`0-${assessments.length-1}/${assessments.length}`});
  }
  // Deny unimplemented endpoints instead of making accidental cloud requests.
  return respond({message:'Fixture endpoint unavailable',code:'42501'},403);
 });
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Palavra-passe').fill('Fictional-password-only');await page.getByRole('button',{name:'Entrar na plataforma'}).click();
 await expect(page.getByRole('combobox',{name:/^Estabelecimento/})).toHaveValue(A);
 return {calls:()=>calls,revocations:()=>revocations};
}

test('dashboard retries errors and opens a student profile with preserved history',async({page})=>{
 await fixture(page,{dashboardError:true});await expect(page.getByRole('alert').filter({hasText:'Não foi possível carregar'})).toContainText('Não foi possível carregar');await page.getByRole('button',{name:'Tentar novamente'}).click();
 await expect(page.getByLabel('Indicadores do estabelecimento')).toContainText('7');
 await page.getByRole('link',{name:'Abrir ficha de Aluno Fictício A'}).click();
 await expect(page.getByRole('heading',{name:'Ficha do aluno',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Aluno Fictício A'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Histórico (1)'})).toBeVisible();await expect(page.getByRole('img',{name:/Evolução/})).toBeVisible();
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
 await expect(page.getByRole('status')).toContainText('Aluno indisponível');await expect(page.getByRole('button',{name:'Guardar avaliação'})).toHaveCount(0);
 await expect(page.getByText('Aluno Fictício A',{exact:true})).toHaveCount(0);
});

test('archived profile is read only while retaining its history',async({page})=>{
 await fixture(page,{archived:true});await page.goto(`/alunos/${C}?org=${A}`);
 await expect(page.getByRole('heading',{name:'Histórico (1)'})).toBeVisible();await expect(page.getByRole('button',{name:'Guardar avaliação'})).toHaveCount(0);
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

test('directory and five item navigation fit a small mobile viewport',async({page})=>{
 await page.setViewportSize({width:375,height:812});await fixture(page);await page.goto('/alunos');await expect(page.getByRole('link',{name:'Abrir ficha',exact:true})).toBeVisible();
 const size=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));expect(size.width).toBeLessThanOrEqual(size.viewport+2);
 await expect(page.getByRole('navigation',{name:'Navegação principal'}).getByRole('link')).toHaveCount(5);
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
