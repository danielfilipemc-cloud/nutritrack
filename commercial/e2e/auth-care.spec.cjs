const {test,expect}=require('@playwright/test');
const {createClient}=require('@supabase/supabase-js');
const {randomUUID}=require('node:crypto');
const {readFileSync}=require('node:fs');
process.loadEnvFile('.env.local');process.loadEnvFile('.env.admin.local');process.loadEnvFile('.aura-integration/accounts.env');
test.use({trace:'off',screenshot:'off',video:'off'});
test.describe.configure({mode:'serial'});
let admin,fixture;
const clientId=randomUUID(),foreignId=randomUUID();
test.beforeAll(async()=>{
 expect(process.env.AURA_E2E_AUTH).toBe('1');const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 expect(new URL(url).hostname).toBe('vfplbkfxipfictuwkkoe.supabase.co');
 fixture=JSON.parse(readFileSync('.aura-integration/fixture.json','utf8'));
 admin=createClient(url,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const result=await admin.from('clients').insert([{id:clientId,organization_id:fixture.oa,full_name:'Fictício E2E '+clientId.slice(0,8)},{id:foreignId,organization_id:fixture.ob,full_name:'Fictício E2E isolado'}]);expect(result.error).toBeNull();
});
test.afterAll(async()=>{
 if(!admin)return;for(const [org,id] of [[fixture.oa,clientId],[fixture.ob,foreignId]]){
  expect((await admin.from('clients').delete().eq('organization_id',org).eq('id',id)).error).toBeNull();
  const remaining=await admin.from('clients').select('id').eq('organization_id',org).eq('id',id);expect(remaining.error).toBeNull();expect(remaining.data).toHaveLength(0);
 }
});
async function login(page,role){await page.goto('/');await page.getByLabel('Email',{exact:true}).fill(process.env[`AURA_TEST_${role}_EMAIL`]);await page.getByLabel('Palavra-passe').fill(process.env[`AURA_TEST_${role}_PASSWORD`]);await page.getByRole('button',{name:'Entrar na plataforma'}).click();await expect(page.getByRole('heading',{name:'Visão geral'})).toBeVisible();}
test.afterEach(async({page})=>{await page.goto('/');await expect(page.getByRole('button',{name:'Terminar sessão'})).toBeVisible();await page.getByRole('button',{name:'Terminar sessão'}).click();await expect(page.getByRole('button',{name:'Entrar na plataforma'})).toBeVisible();});
test('real owner saves a synthetic follow-up and books a session from the profile',async({page})=>{
 await login(page,'OWNER_A');await page.goto(`/alunos/${clientId}?org=${fixture.oa}`);await expect(page.getByLabel('Objetivo do acompanhamento')).toBeEnabled();
 await page.getByLabel('Objetivo do acompanhamento').fill('Objetivo exclusivamente fictício E2E');await page.getByLabel('Profissional responsável').selectOption(fixture.users[2]);await page.getByLabel('Próxima revisão').fill('2026-10-13');
 await page.getByRole('button',{name:'Guardar acompanhamento',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Acompanhamento guardado'})).toBeVisible();
 await page.getByRole('button',{name:'Agenda do aluno'}).click();await page.getByLabel('Data e hora (Lisboa)',{exact:true}).fill('2091-06-15T11:00');await page.getByRole('button',{name:'Guardar marcação',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Marcação guardada'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Cancelar marcação',exact:true})).toBeVisible();
});
test('real coach reads another professional session without managing it and books own slot',async({page})=>{
 await login(page,'COACH_A');await page.goto(`/alunos/${clientId}?org=${fixture.oa}`);await expect(page.getByLabel('Profissional responsável')).toBeDisabled();await expect(page.getByLabel('Objetivo do acompanhamento')).toHaveValue('Objetivo exclusivamente fictício E2E');
 await page.getByRole('button',{name:'Agenda do aluno'}).click();await page.getByLabel('Data da agenda').fill('2091-06-15');await expect(page.locator('.aura-appointment-list>li')).toHaveCount(1);await expect(page.getByRole('button',{name:'Cancelar marcação',exact:true})).toHaveCount(0);
 await page.getByLabel('Data e hora (Lisboa)',{exact:true}).fill('2091-06-15T14:00');await page.getByRole('button',{name:'Guardar marcação',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Marcação guardada'})).toBeVisible();await expect(page.locator('.aura-appointment-list>li')).toHaveCount(2);await expect(page.getByRole('button',{name:'Cancelar marcação',exact:true})).toHaveCount(1);
});
test('real unassigned session has no appointment creation access',async({page})=>{
 await login(page,'UNASSIGNED');await page.goto('/agenda');await expect(page.getByRole('status').filter({hasText:'Sem estabelecimento associado'})).toBeVisible();await expect(page.getByRole('button',{name:'Guardar marcação',exact:true})).toHaveCount(0);
});
