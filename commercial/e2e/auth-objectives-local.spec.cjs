const {openPriorities}=require('./dashboard-helpers.cjs');
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
test.use({trace:'off',screenshot:'off',video:'off'});

test('real local synthetic account manages an objective through the existing profile',async({page,baseURL})=>{
 expect(process.env.AURA_E2E_AUTH).toBe('1');expect(process.env.AURA_E2E_LIVE).not.toBe('1');expect(baseURL).toBe('http://127.0.0.1:3187');
 const file=path.resolve(process.env.AURA_LOCAL_DEMO_FILE||'');
 const root=path.resolve(__dirname,'../.aura-integration')+path.sep;
 expect(file.startsWith(root)).toBe(true);
 const demo=JSON.parse(fs.readFileSync(file,'utf8'));
 expect(demo.scope).toBe('synthetic-local-only');expect(demo.email.endsWith('@example.invalid')).toBe(true);
 expect(new URL(demo.profile_url).origin).toBe(baseURL);
 const unexpected=[];
 // Prevent credentials or authenticated requests leaving the dedicated sandbox,
 // even if the frontend was accidentally built against a different project.
 await page.route('**/*',route=>{
  const origin=new URL(route.request().url()).origin;
  if(origin===baseURL||origin==='http://127.0.0.1:57321')return route.continue();
  unexpected.push(origin);return route.abort();
 });
 await page.goto('/');await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
 await page.getByLabel('Email',{exact:true}).fill(demo.email);
 try{await page.getByLabel('Palavra-passe',{exact:true}).fill(demo.password);}catch{throw new Error('Synthetic credential entry failed; value omitted');}
 await page.getByRole('button',{name:'Entrar na plataforma'}).click();
 await expect(page.getByRole('combobox',{name:/^Estabelecimento/})).toBeVisible();
 await page.goto(demo.profile_url);await page.getByRole('button',{name:'Objetivos',exact:true}).click();
 const region=page.getByRole('region',{name:'Objetivos de acompanhamento',exact:true});
 const title='Objetivo E2E local '+Date.now();
 await region.getByLabel('Título do objetivo',{exact:true}).fill(title);await region.getByRole('button',{name:'Criar objetivo',exact:true}).click();
 await expect(region.getByRole('heading',{name:title,exact:true})).toBeVisible();
 await region.getByRole('button',{name:'Concluir objetivo: '+title,exact:true}).click();
 await expect(region.getByRole('heading',{name:title,exact:true})).toHaveCount(0);await region.getByLabel('Estado dos objetivos').selectOption('completed');
 await expect(region.getByRole('heading',{name:title,exact:true})).toBeVisible();await region.getByText('Histórico dos objetivos',{exact:true}).click();
 await expect(region.getByText(/Objetivo concluído/).first()).toBeVisible();
 await page.goto(demo.profile_url+'&section=evolution');
 await expect(page.getByRole('heading',{name:'Evolução do aluno'})).toBeVisible();
 const timeline=page.getByRole('region',{name:'Cronologia integrada do aluno'});
 await timeline.getByLabel('Tipo de registo').selectOption('assessment');await expect(timeline.getByText('80 kg',{exact:true})).toBeVisible();
 await timeline.getByLabel('Tipo de registo').selectOption('objective');await expect(timeline.getByRole('heading',{name:'Objetivo concluído',exact:true}).first()).toBeVisible();
 await page.goto('/');await openPriorities(page);await expect(page.getByRole('region',{name:'Prioridades do profissional'})).toBeVisible();
 await page.getByRole('button',{name:'Terminar sessão',exact:true}).click();await expect(page.getByRole('button',{name:'Entrar na plataforma'})).toBeVisible();
 expect(unexpected).toEqual([]);
});
