const {test,expect}=require('@playwright/test');const {fixture,A,U}=require('./fixtures.cjs');
const reply=(r,body,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
async function securityFixture(page,{pending=false}={}){
 await fixture(page);let verified=false,exists=pending,required=false,revision=0;
 const user=()=>({id:U,aud:'authenticated',role:'authenticated',email:'synthetic@example.invalid',app_metadata:{provider:'email'},user_metadata:{},factors:exists?[{id:'synthetic-totp',factor_type:'totp',status:verified?'verified':'unverified',friendly_name:'Synthetic authenticator'}]:[]});
 await page.route('**/auth/v1/user',r=>reply(r,user()));
 await page.route('**/auth/v1/factors',r=>{exists=true;return reply(r,{id:'synthetic-totp',type:'totp',totp:{secret:'JBSWY3DPEHPK3PXP',uri:'otpauth://totp/Synthetic',qr_code:'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20"/></svg>'}});});
 await page.route('**/auth/v1/factors/synthetic-totp',r=>{expect(r.request().method()).toBe('DELETE');exists=false;return reply(r,{id:'synthetic-totp'});});
 await page.route('**/auth/v1/factors/synthetic-totp/challenge',r=>reply(r,{id:'synthetic-challenge',expires_at:Math.floor(Date.now()/1000)+60}));
 await page.route('**/auth/v1/factors/synthetic-totp/verify',r=>{expect(r.request().postDataJSON().code).toBe('123456');verified=true;const jwt=[{alg:'HS256',typ:'JWT'},{sub:U,role:'authenticated',aal:'aal2',exp:Math.floor(Date.now()/1000)+3600,amr:[{method:'totp',timestamp:Math.floor(Date.now()/1000)}]},'fixture'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');return reply(r,{access_token:jwt,refresh_token:'synthetic-refresh',expires_in:3600,token_type:'bearer',user:user()});});
 await page.route('**/rpc/aura_security_context',r=>reply(r,{required,revision,can_configure:true}));
 await page.route('**/rpc/aura_security_policy_save',r=>{if(!verified)return reply(r,{code:'PT403'},403);required=r.request().postDataJSON().p_required;revision++;return reply(r,revision);});
}
test('mobile MFA setup challenges code and policy change requires server-confirmed second factor',async({page})=>{
 await page.setViewportSize({width:375,height:812});await securityFixture(page);await page.goto('/seguranca?org='+A);
 const policy=page.getByRole('button',{name:'Exigir MFA nas operações sensíveis',exact:true});await expect(policy).toBeVisible();page.once('dialog',d=>d.accept());await policy.click();await expect(page.getByRole('status')).toContainText('Confirma o segundo fator');
 await page.getByRole('button',{name:'Configurar aplicação autenticadora',exact:true}).click();await expect(page.getByAltText('QR para configurar segundo fator AURA')).toBeVisible();await page.getByLabel('Código da aplicação autenticadora',{exact:true}).fill('123456');await page.getByRole('button',{name:'Confirmar segundo fator',exact:true}).click();
 await expect(page.getByText('Nível desta sessão: segundo fator confirmado.')).toBeVisible();page.once('dialog',d=>d.accept());await policy.click();await expect(page.getByText('Segundo fator recente nas operações sensíveis: obrigatório.')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});
test('interrupted TOTP enrollment can cancel only the pending factor before starting again',async({page})=>{
 await securityFixture(page,{pending:true});await page.goto('/seguranca?org='+A);await expect(page.getByRole('button',{name:'Configurar aplicação autenticadora'})).toHaveCount(0);
 await page.getByRole('button',{name:'Cancelar configuração pendente',exact:true}).click();await expect(page.getByRole('button',{name:'Configurar aplicação autenticadora',exact:true})).toBeVisible();
});

for(const failure of ['network','forbidden','malformed'])test('MFA requirement '+failure+' remains unknown until explicit successful retry',async({page})=>{
 await fixture(page);let fail=true;
 await page.route('**/rpc/aura_security_requirement',r=>!fail?reply(r,{required:true,satisfied:false}):failure==='network'?r.abort('failed'):reply(r,failure==='forbidden'?{code:'42501'}:{},failure==='forbidden'?403:200));
 await page.goto('/alunos');await expect(page.getByText('Não foi possível verificar a obrigação de segundo fator.',{exact:false})).toBeVisible();
 fail=false;await page.getByRole('button',{name:'Tentar verificar novamente'}).click();await expect(page.getByRole('link',{name:'Confirmar em Segurança'})).toBeVisible();
});

test('late successful MFA response for old organization cannot clear new organization error',async({page})=>{
 const {B}=require('./fixtures.cjs');await fixture(page);let release;const pending=new Promise(r=>release=r);let started=false,settled=false;
 await page.route('**/rpc/aura_security_requirement',async r=>{if(r.request().postDataJSON().p_org===A){started=true;await pending;try{return await reply(r,{required:false,satisfied:true});}finally{settled=true;}}return reply(r,{code:'42501'},403);});
 await page.goto('/alunos');await expect.poll(()=>started).toBe(true);await page.getByRole('combobox',{name:/^Estabelecimento/}).selectOption(B);
 await expect(page.getByRole('button',{name:'Tentar verificar novamente'})).toBeVisible();release();await expect.poll(()=>settled).toBe(true);
 await expect(page.getByRole('button',{name:'Tentar verificar novamente'})).toBeVisible();
});

test('MFA session change rechecks the requirement and a failed recheck never clears it',async({page})=>{
 await securityFixture(page);let phase='blocked';
 await page.route('**/rpc/aura_security_requirement',r=>phase==='error'?reply(r,{code:'503'},503):reply(r,{required:true,satisfied:phase==='clear'}));
 await page.goto('/seguranca?org='+A);await expect(page.getByRole('link',{name:'Confirmar em Segurança'})).toBeVisible();
 await page.getByRole('button',{name:'Configurar aplicação autenticadora',exact:true}).click();await page.getByLabel('Código da aplicação autenticadora',{exact:true}).fill('123456');phase='error';
 await page.getByRole('button',{name:'Confirmar segundo fator',exact:true}).click();await expect(page.getByRole('button',{name:'Tentar verificar novamente'})).toBeVisible();
 phase='clear';await page.getByRole('button',{name:'Tentar verificar novamente'}).click();await expect(page.getByRole('button',{name:'Tentar verificar novamente'})).toHaveCount(0);await expect(page.getByRole('link',{name:'Confirmar em Segurança'})).toHaveCount(0);
});
