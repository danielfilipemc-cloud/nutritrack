const {test,expect}=require('@playwright/test');
const {fixture,A,C}=require('./fixtures.cjs');
test('student evolution supports period and metric changes without write controls',async({page})=>{
 await fixture(page,{readOnly:true});await page.goto(`/alunos/${C}?org=${A}`);
 const queries=[];page.on('request',r=>{const url=new URL(r.url());if(url.pathname.endsWith('/assessments')&&url.searchParams.get('limit')==='201')queries.push(url.searchParams);});
 await page.getByRole('button',{name:'Evolução',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Evolução do aluno'})).toBeVisible();
 await expect(page.getByRole('img',{name:/Evolução: 1 medições/})).toBeVisible();
 await page.getByLabel('Período da evolução').selectOption('0');
 await page.getByLabel('Indicador',{exact:true}).selectOption('waist_cm');
 await expect(page.getByText('Regista avaliações para visualizar a evolução.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Guardar avaliação',exact:true})).toHaveCount(0);
 expect(queries.length).toBeGreaterThan(0);for(const q of queries){expect(q.get('organization_id')).toBe(`eq.${A}`);expect(q.get('client_id')).toBe(`eq.${C}`);expect(q.get('superseded_at')).toBe('is.null');expect(q.getAll('assessed_on').some(v=>v.startsWith('lte.'))).toBe(true);}
});
test('read-only pupil schedule hides creation and row mutations',async({page})=>{
 await fixture(page,{readOnly:true,seedAppointments:1});await page.goto(`/alunos/${C}?org=${A}`);
 await page.getByRole('button',{name:'Agenda do aluno',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Marcações',exact:true})).toBeVisible();
 await expect(page.getByText('Sessão · Aluno Fictício A')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Nova marcação',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Editar marcação',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Marcar realizado',exact:true})).toHaveCount(0);
});
test('commercial permissions never reveal evolution and planned integrations do not pretend to be active',async({page})=>{
 await fixture(page,{restricted:true});await page.goto(`/alunos/${C}?org=${A}`);
 await expect(page.getByRole('button',{name:'Evolução',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Treino, nutrição e comunicação',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Acompanhamento integrado'})).toBeVisible();
 await expect(page.getByText('Não existe envio de mensagens nesta área.',{exact:false})).toBeVisible();
});
test('evolution marks incomplete windows and recovers from a failed read',async({page})=>{
 await fixture(page);let calls=0;
 await page.route('**/rest/v1/assessments?**',async route=>{
  const url=new URL(route.request().url());if(url.searchParams.get('select')!=='id,assessed_on,weight_kg,height_cm,waist_cm,superseded_at')return route.fallback();
  // PostgREST retries transient 503 responses; use a terminal read error to exercise the UI retry action.
  calls++;if(calls===1)return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'Synthetic read failure'})});
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon'}).format(new Date());
  const records=Array.from({length:205},(_,i)=>({id:`synthetic-${i}`,assessed_on:today,weight_kg:80,height_cm:null,waist_cm:null,superseded_at:null}));
  const offset=Number(url.searchParams.get('offset')||0),size=Number(url.searchParams.get('limit'));
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(records.slice(offset,offset+size))});
 });
 await page.goto(`/alunos/${C}?org=${A}`);await page.getByRole('button',{name:'Evolução',exact:true}).click();
 await expect(page.getByText('Não foi possível carregar a evolução.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Atualizar evolução'}).click();
 await expect(page.getByText(/200 avaliações carregadas/)).toBeVisible();
 await page.getByRole('button',{name:'Carregar mais avaliações'}).click();
 await expect(page.getByText(/205 avaliações carregadas/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Carregar mais avaliações'})).toHaveCount(0);
});

test('evolution passes one thousand records without falsely marking the API cap as complete',async({page})=>{
 test.setTimeout(60000);
 await fixture(page);const requests=[];
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon'}).format(new Date());
 const records=Array.from({length:1205},(_,i)=>({id:`synthetic-${String(i).padStart(5,'0')}`,assessed_on:today,weight_kg:80+i/100,height_cm:null,waist_cm:null,superseded_at:null}));
 await page.route('**/rest/v1/assessments?**',async route=>{
  const url=new URL(route.request().url());if(url.searchParams.get('select')!=='id,assessed_on,weight_kg,height_cm,waist_cm,superseded_at')return route.fallback();
  const offset=Number(url.searchParams.get('offset')||0),size=Number(url.searchParams.get('limit'));requests.push({offset,size,org:url.searchParams.get('organization_id'),client:url.searchParams.get('client_id')});
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(records.slice(offset,offset+Math.min(size,1000)))});
 });
 await page.goto(`/alunos/${C}?org=${A}`);await page.getByRole('button',{name:'Evolução',exact:true}).click();
 for(const count of [200,400,600,800,1000,1200]){
  await expect(page.getByText(new RegExp(`^${count} avaliações carregadas`))).toBeVisible();
  await expect(page.getByText(/Todas as avaliações atuais do período foram carregadas/)).toHaveCount(0);
  await page.getByRole('button',{name:'Carregar mais avaliações'}).click();
 }
 await expect(page.getByText(/^1205 avaliações carregadas/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Carregar mais avaliações'})).toHaveCount(0);
 expect(requests.some(r=>r.offset>1000)).toBe(true);
 for(const r of requests){expect(r.size).toBeLessThanOrEqual(201);expect(r.org).toBe(`eq.${A}`);expect(r.client).toBe(`eq.${C}`);}
});
