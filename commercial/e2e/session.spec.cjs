const {test,expect}=require('@playwright/test');
const {fixture,A,C}=require('./fixtures.cjs');

test('profile can end the global session and removes authenticated content',async({page})=>{
 await fixture(page);let scope;
 page.on('request',r=>{const url=new URL(r.url());if(url.pathname.endsWith('/auth/v1/logout'))scope=url.searchParams.get('scope');});
 await page.goto(`/alunos/${C}?org=${A}`);
 await expect(page.getByRole('button',{name:'Resumo',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Terminar sessão',exact:true}).click();
 await expect(page.getByRole('button',{name:'Entrar na plataforma'})).toBeVisible();
 expect(scope).toBe('global');
 await expect(page.getByRole('button',{name:'Resumo',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Terminar sessão',exact:true})).toHaveCount(0);
});

test('failed global revocation explains local logout and allows retry after signing in again',async({page})=>{
 await fixture(page);let attempts=0;
 await page.route('**/auth/v1/logout**',route=>{
  attempts++;if(attempts===1)return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'synthetic_denial',message:'Synthetic logout failure'})});
  return route.fallback();
 });
 await page.goto('/alunos');await page.getByRole('button',{name:'Terminar sessão',exact:true}).click();
 await expect(page.getByText('Não foi possível confirmar o fim das restantes sessões. A sessão local foi removida. Volta a entrar para tentar novamente.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Terminar sessão',exact:true})).toHaveCount(0);
 await page.getByLabel('Email',{exact:true}).fill('synthetic@example.invalid');await page.getByLabel('Palavra-passe',{exact:true}).fill('Synthetic-fixture-only-123!');
 await page.getByRole('button',{name:'Entrar na plataforma'}).click();
 await expect(page.getByRole('button',{name:'Terminar sessão',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Terminar sessão',exact:true}).click();
 await expect(page.getByRole('button',{name:'Entrar na plataforma'})).toBeVisible();expect(attempts).toBe(2);
});
