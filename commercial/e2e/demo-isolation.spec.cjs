const {test,expect}=require('@playwright/test');
const {fixture,A,C}=require('./fixtures.cjs');
async function openSection(page,width,label,value){
 if(width<=900)await page.getByLabel('Área da ficha',{exact:true}).selectOption(value);
 else await page.getByRole('navigation',{name:'Secções da ficha',exact:true}).getByRole('button',{name:label,exact:true}).click();
}
for(const width of [320,375,1440])test(`demo stays offline and isolates student drafts ${width}`,async({page})=>{
 test.setTimeout(90000);
 await page.setViewportSize({width,height:950});
 const forbidden=[];
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.origin!=='http://127.0.0.1:3187'||/^\/(api|rest|auth)\//.test(u.pathname)){forbidden.push(u.origin+u.pathname);return route.abort();}
  return route.continue();
 });
 await page.goto('/demo/experiencia?org=private-canary&client='+C+'&section=care');
 await page.evaluate(()=>{localStorage.setItem('demo-isolation-canary','PRIVATE_FIXTURE_ONLY');sessionStorage.setItem('demo-session-canary','PRIVATE_SESSION_FIXTURE');});
 const storage=()=>page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}));
 const before=await storage();
 const nav=page.getByRole('navigation',{name:width>800?'Navegação da demonstração':'Áreas da demonstração'});
 await nav.getByRole('button',{name:'Ficha 360.º'}).click();
 await openSection(page,width,'Avaliações','assessments');
 await page.getByLabel('Peso (kg)',{exact:true}).fill('68.5');
 await page.getByLabel('Escolher aluno',{exact:true}).selectOption('2');
 await openSection(page,width,'Avaliações','assessments');
 await expect(page.getByLabel('Peso (kg)',{exact:true})).toHaveValue('');
 await page.getByLabel('Escolher aluno',{exact:true}).selectOption('1');
 await openSection(page,width,'Avaliações','assessments');
 await expect(page.getByLabel('Peso (kg)',{exact:true})).toHaveValue('68.5');
 await page.getByRole('button',{name:'Guardar avaliação',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Avaliação fictícia guardada');
 await expect(page.getByRole('cell',{name:'68.5',exact:true})).toBeVisible();
 await openSection(page,width,'Acompanhamento','care');
 await page.getByLabel('Objetivo fictício').fill('Objetivo local da Sofia');
 await page.getByLabel('Profissional responsável',{exact:true}).selectOption('Profissional Demonstração');
 await page.getByLabel('Próxima revisão',{exact:true}).fill('2026-10-25');
 await nav.getByRole('button',{name:'Agenda',exact:true}).click();
 await nav.getByRole('button',{name:'Ficha 360.º'}).click();
 await expect(page.getByLabel('Objetivo fictício')).toHaveValue('Objetivo local da Sofia');
 await page.getByRole('button',{name:'Guardar acompanhamento',exact:true}).click();
 await expect(page.locator('.aura-preview-context')).toContainText('Profissional Demonstração');
 await expect(page.locator('.aura-preview-context')).toContainText('2026-10-25');
 await page.getByLabel('Escolher aluno',{exact:true}).selectOption('2');
 await openSection(page,width,'Acompanhamento','care');
 await expect(page.getByLabel('Objetivo fictício')).not.toHaveValue('Objetivo local da Sofia');
 await openSection(page,width,'Agenda do aluno','agenda');
 await expect(page.locator('.aura-preview-hubbody')).toContainText('10:30');
 await expect(page.locator('.aura-preview-hubbody')).not.toContainText('09:00');
 await nav.getByRole('button',{name:'A tua marca'}).click();
 await page.getByLabel('Nome do espaço',{exact:true}).fill('Espaço Fictício');
 await nav.getByRole('button',{name:'Alunos',exact:true}).click();
 await page.getByPlaceholder('Ex.: Joana Exemplo').fill('Nova Exemplo');await page.getByRole('button',{name:'Adicionar aluno'}).click();
 await expect(page.getByRole('heading',{name:'Nova Exemplo',exact:true})).toBeVisible();
 await openSection(page,width,'Resumo','overview');
 await expect(page.getByText('Sem medição',{exact:true})).toHaveCount(3);
 await openSection(page,width,'Evolução','evolution');
 await expect(page.getByText('Regista avaliações para visualizar a evolução.',{exact:true})).toBeVisible();
 await openSection(page,width,'Agenda do aluno','agenda');
 await expect(page.getByText('Sem marcações de exemplo para este aluno.',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await storage()).toEqual(before);expect(forbidden).toEqual([]);
 await page.reload();await nav.getByRole('button',{name:'Ficha 360.º'}).click();
 await expect(page.getByRole('heading',{name:'Sofia Exemplo',exact:true})).toBeVisible();
 await expect(page.getByLabel('Escolher aluno').locator('option')).toHaveCount(3);
 await expect(page.locator('.aura-preview-context')).toContainText('Profissional Exemplo');
 expect(forbidden).toEqual([]);expect(await storage()).toEqual(before);
});
test('a professional fixture session is neither read nor changed by the demo',async({page})=>{
 await fixture(page);const before=await page.evaluate(()=>({...localStorage}));const requests=[];
 await page.route('**/auth/v1/**',r=>{requests.push('auth');return r.abort();});
 await page.route('**/rest/v1/**',r=>{requests.push('rest');return r.abort();});
 await page.goto(`/demo/experiencia?org=${A}&client=${C}`);
 await page.getByRole('navigation',{name:'Navegação da demonstração'}).getByRole('button',{name:'Ficha 360.º'}).click();
 await expect(page.getByRole('heading',{name:'Sofia Exemplo',exact:true})).toBeVisible();
 await expect(page.getByText('Aluno Fictício A',{exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>({...localStorage}))).toEqual(before);expect(requests).toEqual([]);
});
test('anonymous private profile does not fall back to demo records',async({page})=>{
 const calls=[];await page.route('**/rest/v1/**',r=>{calls.push(r.request().url());return r.abort();});
 await page.goto(`/alunos/${C}?org=${A}&section=overview`);
 await expect(page.getByRole('link',{name:'Iniciar sessão',exact:true})).toBeVisible();
 await expect(page.getByText('Sofia Exemplo',{exact:true})).toHaveCount(0);expect(calls).toEqual([]);
});
test('keyboard submission, validation and metric changes work without a backend',async({page})=>{
 await page.setViewportSize({width:375,height:950});await page.goto('/demo/experiencia');
 await page.getByRole('navigation',{name:'Áreas da demonstração'}).getByRole('button',{name:'Alunos',exact:true}).click();
 await page.getByPlaceholder('Ex.: Joana Exemplo').fill('Teclado Exemplo');await page.getByPlaceholder('Ex.: Joana Exemplo').press('Enter');
 await expect(page.getByRole('heading',{name:'Teclado Exemplo'})).toBeVisible();
 await openSection(page,375,'Avaliações','assessments');
 await page.getByRole('button',{name:'Guardar avaliação'}).click();await expect(page.getByRole('status').filter({hasText:'Preenche pelo menos uma medição.'})).toBeVisible();
 await page.getByLabel('Peso (kg)',{exact:true}).fill('68.5');await page.getByLabel('Peso (kg)',{exact:true}).press('Enter');
 await openSection(page,375,'Evolução','evolution');await expect(page.getByRole('img',{name:/1 medições/})).toBeVisible();
 await page.getByLabel('Indicador da evolução').selectOption('height');await expect(page.getByText('Regista avaliações para visualizar a evolução.',{exact:true})).toBeVisible();
});
test('local review drives priorities and repeated dates replace only a local example',async({page})=>{
 await page.goto('/demo/experiencia');
 const nav=page.getByRole('navigation',{name:'Navegação da demonstração'});
 await expect(page.getByRole('heading',{name:'Prioridades de exemplo'})).toBeVisible();
 await nav.getByRole('button',{name:'Ficha 360.º'}).click();
 await openSection(page,1440,'Acompanhamento','care');
 await page.getByLabel('Próxima revisão',{exact:true}).fill('2026-10-25');
 await page.getByRole('button',{name:'Guardar acompanhamento',exact:true}).click();
 await nav.getByRole('button',{name:'Visão geral',exact:true}).click();
 await expect(page.getByText('Sem revisões pendentes no dia de exemplo.',{exact:true})).toBeVisible();
 await nav.getByRole('button',{name:'Ficha 360.º'}).click();
 await openSection(page,1440,'Avaliações','assessments');
 for(const value of ['68.5','69.2']){
  await page.getByLabel('Peso (kg)',{exact:true}).fill(value);
  await page.getByRole('button',{name:'Guardar avaliação',exact:true}).click();
 }
 const history=page.getByRole('table',{name:'Avaliações fictícias de Sofia Exemplo'});
 await expect(history.getByRole('row')).toHaveCount(4);
 await expect(history.getByRole('cell',{name:'68.5',exact:true})).toHaveCount(0);
 await expect(history.getByRole('cell',{name:'69.2',exact:true})).toBeVisible();
 await page.getByLabel('Escolher aluno',{exact:true}).selectOption('2');
 await openSection(page,1440,'Avaliações','assessments');
 await expect(page.getByRole('cell',{name:'69.2',exact:true})).toHaveCount(0);
});
