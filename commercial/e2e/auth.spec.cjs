const {test,expect}=require('@playwright/test');
const {existsSync,readFileSync}=require('node:fs');
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
if(existsSync('.aura-integration/accounts.env'))process.loadEnvFile('.aura-integration/accounts.env');
// Opt-in read-only checks against the dedicated development Supabase. Never record credentials.
test.use({trace:'off',screenshot:'off',video:'off'});
let fixture;
test.beforeAll(()=>{
 expect(process.env.AURA_E2E_AUTH).toBe('1');
 expect(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname).toBe('vfplbkfxipfictuwkkoe.supabase.co');
 fixture=JSON.parse(readFileSync('.aura-integration/fixture.json','utf8'));
 expect(fixture.project).toBe('vfplbkfxipfictuwkkoe.supabase.co');
});
async function login(page,role){
 const email=process.env[`AURA_TEST_${role}_EMAIL`],password=process.env[`AURA_TEST_${role}_PASSWORD`];
 if(!email||!password)throw new Error('Missing local synthetic account credentials');
 await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByLabel('Palavra-passe').fill(password);await page.getByRole('button',{name:'Entrar na plataforma'}).click();
 await expect(page.getByRole('heading',{name:'Visão geral'})).toBeVisible();
}
test.afterEach(async({page})=>{
 await page.goto('/');const logout=page.getByRole('button',{name:'Terminar sessão'});
 await expect(logout).toBeVisible();await logout.click();await expect(page.getByRole('button',{name:'Entrar na plataforma'})).toBeVisible();
});
test('real owner session reads own profile and foreign client lookup exposes no history',async({page})=>{
 await login(page,'OWNER_A');await page.goto(`/alunos/${fixture.ca}?org=${fixture.oa}`);
 await page.getByRole('button',{name:'Avaliações',exact:true}).click();await expect(page.getByRole('heading',{name:/Histórico/})).toBeVisible();
 await page.goto(`/alunos/${fixture.cb}?org=${fixture.oa}`);
 await expect(page.getByRole('status')).toContainText('Aluno indisponível');await expect(page.getByRole('heading',{name:/Histórico/})).toHaveCount(0);
});
test('real coach session cannot manage branding or team',async({page})=>{
 await login(page,'COACH_A');await page.goto('/marca');await expect(page.getByLabel('Nome da marca')).toBeDisabled();
 await page.goto('/equipa');await expect(page.getByRole('heading',{name:'Acesso reservado'})).toBeVisible();await expect(page.getByRole('button',{name:'Criar convite'})).toHaveCount(0);
});
test('real unassigned session has no establishment or dashboard data',async({page})=>{
 await login(page,'UNASSIGNED');await expect(page.getByRole('status').filter({hasText:'Sem estabelecimento associado'})).toBeVisible();
 await expect(page.getByLabel('Indicadores do estabelecimento')).toHaveCount(0);
 await page.goto('/alunos');await expect(page.getByRole('button',{name:'Registar aluno'})).toHaveCount(0);
});
