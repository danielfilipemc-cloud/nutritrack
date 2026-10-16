const {test,expect}=require('@playwright/test');
const fs=require('node:fs');const path=require('node:path');
// Separate config: never collected by normal fixtures or the historical live suite.
test.skip(process.env.AURA_STAGING_BROWSER_CONFIRM!=='vgbwmamntjmhzrpvhxzb','Dedicated synthetic online staging only');
let demo;
test.beforeEach(async({page,baseURL})=>{
 expect(baseURL).toBe('https://aura-business-staging.onrender.com');
 const file=path.resolve(process.env.AURA_ONLINE_DEMO_FILE||'');expect(file.startsWith(path.resolve(__dirname,'../.aura-integration')+path.sep)).toBe(true);
 demo=JSON.parse(fs.readFileSync(file,'utf8'));expect(demo.scope).toBe('synthetic-cloud-online-demo');expect(demo.status).toBe('READY');expect(demo.base_url).toBe(baseURL);
 await page.route('**/*',route=>['https://aura-business-staging.onrender.com','https://vgbwmamntjmhzrpvhxzb.supabase.co'].includes(new URL(route.request().url()).origin)?route.continue():route.abort());
});
async function login(page,role){
 const actor=demo.accounts.find(a=>a.role===role);expect(actor.email.endsWith('@example.invalid')).toBe(true);
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(actor.email);
 try{await page.getByLabel('Palavra-passe',{exact:true}).fill(actor.password);}catch{throw Error('Synthetic credential entry failed; omitted');}
 const response=page.waitForResponse(r=>r.url().includes('/auth/v1/token?grant_type=password')&&r.status()===200);
 await page.getByRole('button',{name:'Entrar na plataforma'}).click();await response;
 await expect(page.getByRole('button',{name:'Entrar na plataforma'})).toHaveCount(0);
}
test('assigned coach consults evolution and completes an objective online',async({page})=>{
 await login(page,'coach');await page.goto(demo.profile_url+'&section=evolution');
 await expect(page.getByRole('heading',{name:'Evolução do aluno'})).toBeVisible();
 const timeline=page.getByRole('region',{name:'Cronologia integrada do aluno'});await timeline.getByLabel('Tipo de registo').selectOption('assessment');await expect(timeline.getByText('81 kg',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Objetivos',exact:true}).click();const region=page.getByRole('region',{name:'Objetivos de acompanhamento',exact:true});
 const title='Objetivo sintético online '+Date.now();await region.getByLabel('Título do objetivo',{exact:true}).fill(title);await region.getByRole('button',{name:'Criar objetivo',exact:true}).click();
 await expect(region.getByRole('heading',{name:title,exact:true})).toBeVisible();await region.getByRole('button',{name:'Concluir objetivo: '+title,exact:true}).click();
 await region.getByLabel('Estado dos objetivos').selectOption('completed');await expect(region.getByRole('heading',{name:title,exact:true})).toBeVisible();
});
test('student receives only the explicitly shared measurement',async({page})=>{
 await login(page,'student');await page.goto('/aluno');await expect(page.getByRole('heading',{name:'Alex — aluno fictício'})).toBeVisible();
 const rows=page.locator('tbody tr');await expect(rows).toHaveCount(1);await expect(rows.first()).toContainText('81');
 await expect(page.getByLabel('Título do objetivo',{exact:true})).toHaveCount(0);
});
test('manager can manage the team without implicit measurement access',async({page})=>{
 await login(page,'manager');await page.goto('/equipa');await expect(page.getByRole('heading',{name:'Convidar profissional',exact:true})).toBeVisible();
 const permissions=page.waitForResponse(r=>r.url().endsWith('/rest/v1/rpc/aura_client_permissions')&&r.status()===200);
 await page.goto(demo.profile_url+'&section=evolution');const access=await (await permissions).json();expect(access.assessments_read).toBe(false);
 await expect(page.getByRole('heading',{name:'Alex — aluno fictício',exact:true})).toBeVisible();
 await expect(page.getByText('Medições reservadas aos profissionais autorizados.',{exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Evolução do aluno'})).toHaveCount(0);
 await expect(page.getByText('81 kg',{exact:true})).toHaveCount(0);
});
