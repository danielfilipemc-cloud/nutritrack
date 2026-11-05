const {test,expect}=require('@playwright/test');const {fixture,U}=require('./fixtures.cjs');
const reply=(r,body,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
const token=()=>[{alg:'HS256',typ:'JWT'},{sub:U,role:'authenticated',aal:'aal1',exp:Math.floor(Date.now()/1000)+3600},'synthetic'].map(v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url')).join('.');
const callback=()=>'/#'+new URLSearchParams({type:'recovery',access_token:token(),refresh_token:'synthetic-recovery-refresh',expires_in:'3600',token_type:'bearer'});
async function recovered(page,{save,factors=[]}={}){
 await fixture(page);await page.route('**/auth/v1/user',r=>r.request().method()==='PUT'?(save?save(r):reply(r,{id:U,aud:'authenticated',role:'authenticated',factors})):reply(r,{id:U,aud:'authenticated',role:'authenticated',factors}));
 await page.goto(callback());await expect(page.getByLabel('Nova palavra-passe',{exact:true})).toBeVisible();
}
for(const status of [200,400,429])test('recovery request uses the same generic response for HTTP '+status,async({page})=>{
 await fixture(page);let body,redirect;
 await page.route('**/auth/v1/recover**',r=>{body=r.request().postDataJSON();redirect=new URL(r.request().url()).searchParams.get('redirect_to');return reply(r,status===200?{}:{message:'synthetic_account_exists',code:'user_not_found'},status);});
 await page.goto('/recuperar?next=https://evil.invalid');await page.getByLabel('Email',{exact:true}).fill('synthetic@example.invalid');await page.getByRole('button',{name:'Pedir ligação de recuperação'}).click();
 await expect(page.getByRole('status')).toContainText('Se existir uma conta associada');expect(body.email).toBe('synthetic@example.invalid');expect(redirect).toBe('http://127.0.0.1:3187/');await expect(page.getByRole('button',{name:'Aguarda antes de repetir'})).toBeDisabled();await expect(page.getByText('synthetic_account_exists')).toHaveCount(0);
});
test('a rejected password retains the draft and a failed global logout never reports confirmed revocation',async({page})=>{
 let deny=true;await recovered(page,{save:r=>deny?reply(r,{code:'weak_password',msg:'private-rejection'},422):reply(r,{id:U})});
 const pass='Synthetic-new-password-123!';await page.getByLabel('Nova palavra-passe',{exact:true}).fill(pass);await page.getByLabel('Confirmar nova palavra-passe',{exact:true}).fill(pass);await page.getByRole('button',{name:'Guardar nova palavra-passe'}).click();await expect(page.getByRole('status')).toContainText('não foi aceite');await expect(page.getByLabel('Nova palavra-passe',{exact:true})).toHaveValue(pass);await expect(page.getByText('private-rejection')).toHaveCount(0);
 deny=false;await page.route('**/auth/v1/logout**',r=>reply(r,{code:'synthetic_denial',message:'private-logout'},400));await page.getByRole('button',{name:'Guardar nova palavra-passe'}).click();await expect(page.getByRole('status')).toContainText('Não foi possível confirmar o fim das restantes sessões');await expect(page.getByLabel('Nova palavra-passe',{exact:true})).toHaveCount(0);
});
test('verified MFA cannot be bypassed by submitting again or using an invalid code',async({page})=>{
 let writes=0;await recovered(page,{factors:[{id:'synthetic-factor',factor_type:'totp',status:'verified'}],save:r=>{writes++;return reply(r,{id:U});}});
 await page.route('**/factors/synthetic-factor/challenge',r=>reply(r,{id:'synthetic-challenge',expires_at:Math.floor(Date.now()/1000)+60}));await page.route('**/factors/synthetic-factor/verify',r=>reply(r,{code:'mfa_verification_failed',msg:'private-factor'},400));
 await page.getByLabel('Nova palavra-passe',{exact:true}).fill('Synthetic-new-password-123!');await page.getByLabel('Confirmar nova palavra-passe',{exact:true}).fill('Synthetic-new-password-123!');await page.getByRole('button',{name:'Guardar nova palavra-passe'}).click();await expect(page.getByLabel('Código da aplicação autenticadora',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Guardar nova palavra-passe'}).click();expect(writes).toBe(0);
 await page.getByLabel('Código da aplicação autenticadora',{exact:true}).fill('123456');await page.getByRole('button',{name:'Confirmar segundo fator',exact:true}).click();await expect(page.getByRole('status')).toContainText('Não foi possível confirmar o segundo fator');await expect(page.getByLabel('Código da aplicação autenticadora',{exact:true})).toHaveValue('');expect(writes).toBe(0);
});
test('network loss during a recovery request is explicit and retryable',async({page})=>{
 await fixture(page);await page.route('**/auth/v1/recover**',r=>r.abort('failed'));await page.goto('/recuperar');await page.getByLabel('Email',{exact:true}).fill('synthetic@example.invalid');await page.getByRole('button',{name:'Pedir ligação de recuperação'}).click();await expect(page.getByRole('status')).toContainText('Não foi possível concluir');await expect(page.getByRole('button',{name:'Pedir ligação de recuperação'})).toBeEnabled();
});
for(const suffix of ['#error=access_denied&error_code=otp_expired&error_description=private-error','?recuperacao=1','#type=recovery'])test('invalid or incomplete recovery never falls back to a cached session: '+suffix,async({page})=>{
 await fixture(page);let writes=0,organizations=0;page.on('request',r=>{if(r.method()==='PUT'&&r.url().includes('/auth/v1/user'))writes++;if(r.url().includes('/organization_members'))organizations++;});
 await page.goto('/'+suffix);await expect(page.getByRole('status')).toContainText('Ligação inválida, expirada ou já utilizada');await expect(page.getByLabel('Nova palavra-passe',{exact:true})).toHaveCount(0);expect(writes).toBe(0);expect(organizations).toBe(0);await expect(page).toHaveURL(/\?recuperacao=1$/);await expect(page.getByText('private-error')).toHaveCount(0);
});
test('password recovery validates confirmation, updates once, globally logs out and keeps secrets out of the URL',async({page})=>{
 let writes=0;await recovered(page,{save:r=>{writes++;expect(r.request().postDataJSON().password).toBe('Synthetic-new-password-123!');return reply(r,{id:U});}});
 await expect(page).toHaveURL(/\?recuperacao=1$/);await page.getByLabel('Nova palavra-passe',{exact:true}).fill('Synthetic-new-password-123!');await page.getByLabel('Confirmar nova palavra-passe',{exact:true}).fill('different');await page.getByRole('button',{name:'Guardar nova palavra-passe'}).click();await expect(page.getByRole('status')).toContainText('não coincidem');expect(writes).toBe(0);
 await page.getByLabel('Confirmar nova palavra-passe',{exact:true}).fill('Synthetic-new-password-123!');await page.getByRole('button',{name:'Guardar nova palavra-passe'}).click();await expect(page.getByRole('status')).toContainText('Palavra-passe alterada. Inicia sessão');expect(writes).toBe(1);await expect(page.getByLabel('Nova palavra-passe',{exact:true})).toHaveCount(0);
});
test('a lost password update acknowledgement is uncertain and cannot be silently repeated',async({page})=>{
 await recovered(page,{save:r=>r.abort('failed')});await page.getByLabel('Nova palavra-passe',{exact:true}).fill('Synthetic-new-password-123!');await page.getByLabel('Confirmar nova palavra-passe',{exact:true}).fill('Synthetic-new-password-123!');await page.getByRole('button',{name:'Guardar nova palavra-passe'}).click();await expect(page.getByRole('status')).toContainText('nova palavra-passe pode ter sido guardada');await expect(page.getByRole('button',{name:'Guardar nova palavra-passe'})).toHaveCount(0);await expect(page.getByRole('link',{name:'Pedir nova ligação'})).toBeVisible();
});
test('mobile recovery form is keyboard reachable without horizontal overflow',async({page})=>{
 await page.setViewportSize({width:320,height:800});await fixture(page);await page.getByRole('button',{name:'Terminar sessão',exact:true}).click();await page.getByRole('link',{name:'Recuperar palavra-passe',exact:true}).click();await expect(page.getByRole('heading',{name:'Recuperar palavra-passe',exact:true})).toBeVisible();await page.getByLabel('Email',{exact:true}).focus();await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Pedir ligação de recuperação'})).toBeFocused();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);await page.screenshot({path:'.aura-integration/password-recovery/request-320.png',fullPage:true});
});
test('logout while a password write is pending discards the late success and clears the form',async({page})=>{
 let release,started=false,settled=false;const pending=new Promise(r=>release=r);await recovered(page,{save:async r=>{started=true;await pending;try{await reply(r,{id:U});}finally{settled=true;}}});
 await page.getByLabel('Nova palavra-passe',{exact:true}).fill('Synthetic-new-password-123!');await page.getByLabel('Confirmar nova palavra-passe',{exact:true}).fill('Synthetic-new-password-123!');await page.getByRole('button',{name:'Guardar nova palavra-passe'}).click();await expect.poll(()=>started).toBe(true);
 await page.evaluate(()=>{const c=new BroadcastChannel('sb-aura-test-auth-token');c.postMessage({event:'SIGNED_OUT',session:null});setTimeout(()=>c.close(),100);});
 await expect(page.getByRole('status')).toContainText('Ligação inválida');release();await expect.poll(()=>settled).toBe(true);await expect(page.getByRole('status')).toContainText('Ligação inválida');await expect(page.getByLabel('Nova palavra-passe',{exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:'Palavra-passe alterada',exact:true})).toHaveCount(0);
});
