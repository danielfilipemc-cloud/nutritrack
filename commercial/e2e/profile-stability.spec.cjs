const {test,expect}=require('@playwright/test');
const {fixture,A,B,C}=require('./fixtures.cjs');
const profile=`/alunos/${C}?org=${A}`;
const pupil=page=>page.getByRole('heading',{name:'Aluno Fictício A',exact:true});
function isLookup(request){const url=new URL(request.url());return url.pathname.endsWith('/clients')&&url.searchParams.get('id')===`eq.${C}`;}
async function holdFirstLookup(page){
 let release,started=false,calls=0;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/rest/v1/clients?*',async route=>{if(!isLookup(route.request()))return route.fallback();calls++;if(calls===1){started=true;await gate;}return route.fallback();});
 return {release,started:()=>started,calls:()=>calls};
}

test('profile lookup completing within the existing deadline opens without a retry',async({page})=>{
 await fixture(page);await page.clock.install();const pending=await holdFirstLookup(page);await page.goto(profile);await expect.poll(pending.started).toBe(true);
 await page.clock.runFor(7000);await expect(pupil(page)).toHaveCount(0);await expect(page.getByRole('button',{name:'Tentar abrir ficha'})).toHaveCount(0);
 pending.release();await expect(pupil(page)).toBeVisible();expect(pending.calls()).toBe(1);
});

test('profile deadline exposes a retry without automatic requests or stale personal data',async({page})=>{
 await fixture(page);await page.clock.install();const pending=await holdFirstLookup(page);await page.goto(profile);await expect.poll(pending.started).toBe(true);
 await page.clock.runFor(8100);await expect(page.getByText('Não foi possível abrir a ficha.',{exact:true})).toBeVisible();await expect(pupil(page)).toHaveCount(0);expect(pending.calls()).toBe(1);
 pending.release();await page.getByRole('button',{name:'Tentar abrir ficha'}).click();await expect(pupil(page)).toBeVisible();expect(pending.calls()).toBe(2);
 await expect(page.getByText('Não foi possível abrir a ficha.',{exact:true})).toHaveCount(0);
});

test('retry after authentication or permission denial cannot expose the previous profile',async({page})=>{
 await fixture(page);let calls=0,permissions=0;
 page.on('request',request=>{if(request.url().endsWith('/rpc/aura_client_permissions'))permissions++;});
 await page.route('**/rest/v1/clients?*',route=>{
  if(!isLookup(route.request()))return route.fallback();calls++;
  return route.fulfill({status:calls===1?401:403,contentType:'application/json',body:JSON.stringify({code:'42501',message:'Synthetic authorization denial'})});
 });
 await page.goto(profile);await expect(page.getByRole('button',{name:'Tentar abrir ficha'})).toBeVisible();await page.getByRole('button',{name:'Tentar abrir ficha'}).click();await expect.poll(()=>calls).toBe(2);
 await expect(page.getByRole('button',{name:'Tentar abrir ficha'})).toBeVisible();await expect(pupil(page)).toHaveCount(0);await expect(page.getByRole('button',{name:'Guardar avaliação'})).toHaveCount(0);expect(permissions).toBe(0);
});

test('late lookup failure from organization A cannot replace organization B state',async({page})=>{
 await fixture(page);let release,started=false,settled=false;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/rest/v1/clients?*',async route=>{if(!isLookup(route.request()))return route.fallback();const url=new URL(route.request().url());if(url.searchParams.get('organization_id')!==`eq.${A}`)return route.fallback();started=true;await gate;await route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'42501',message:'Synthetic late denial'})});settled=true;});
 await page.goto(profile);await expect.poll(()=>started).toBe(true);await page.getByRole('combobox',{name:/^Estabelecimento/}).selectOption(B);release();await expect.poll(()=>settled).toBe(true);
 await expect(page.getByRole('combobox',{name:/^Estabelecimento/})).toHaveValue(B);await expect(pupil(page)).toHaveCount(0);await expect(page.getByRole('button',{name:'Tentar abrir ficha'})).toHaveCount(0);await expect(page.getByText('Não foi possível abrir a ficha.',{exact:true})).toHaveCount(0);
});

test('logout during an initial lookup invalidates its late response',async({page})=>{
 await fixture(page);const pending=await holdFirstLookup(page);await page.goto(profile);await expect.poll(pending.started).toBe(true);await page.getByRole('button',{name:'Terminar sessão',exact:true}).click();
 await expect(page.getByRole('button',{name:'Entrar na plataforma',exact:true})).toBeVisible();pending.release();await expect(pupil(page)).toHaveCount(0);await expect(page.getByRole('button',{name:'Guardar avaliação'})).toHaveCount(0);
});
