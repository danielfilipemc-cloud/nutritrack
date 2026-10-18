const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {fixture,A,C}=require('./fixtures.cjs');
// Contract fixtures only: no cloud identities, credentials or production requests.
const cases=[['dashboard','/'],['directory','/alunos'],['profile',`/alunos/${C}?org=${A}`],...['assessments','evolution','objectives','care'].map(s=>[s,`/alunos/${C}?org=${A}&section=${s}`]),['agenda','/agenda'],['brand','/marca'],['empty','/alunos'],['error','/']];
for(const width of [1440,375])for(const [name,url] of cases)test(`refinement visual ${name} ${width}`,async({page})=>{
 await page.setViewportSize({width,height:width===375?812:1000});await fixture(page,{seedObjectives:3,seedAppointments:2,seedTimeline:16});
 if(name==='empty')await page.route('**/rest/v1/clients?*',r=>r.fulfill({contentType:'application/json',headers:{'content-range':'*/0'},body:'[]'}));
 if(name==='error')await page.route('**/rpc/aura_care_dashboard',r=>r.abort('failed'));
 await page.goto(url);await expect(page.getByRole('heading',{level:1})).toBeVisible();
 if(name==='dashboard')await expect(page.getByLabel('Indicadores do estabelecimento')).toBeVisible();
 if(name==='directory')await expect(page.getByRole('link',{name:'Abrir ficha',exact:true})).toBeVisible();
 if(name==='profile')await expect(page.getByRole('heading',{name:'Resumo da evolução',exact:true})).toBeVisible();
 if(name==='evolution')await expect(page.getByRole('heading',{name:'Evolução do aluno',exact:true})).toBeVisible();
 if(name==='objectives')await expect(page.getByRole('heading',{name:'Objetivo fictício 1',exact:true})).toBeVisible();
 if(name==='care')await expect(page.getByRole('textbox',{name:'Objetivo do acompanhamento',exact:true})).toBeEnabled();
 if(name==='brand')await expect(page.getByLabel('Cor principal')).toBeEnabled();
 if(name==='empty')await expect(page.getByText('Sem alunos para os filtros selecionados.',{exact:true})).toBeVisible();
 if(name==='error')await expect(page.getByRole('alert').filter({hasText:'Não foi possível carregar o painel'})).toBeVisible();
 await page.waitForTimeout(200);
 const metrics=await page.evaluate(()=>({height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,viewport:innerWidth,h1:document.querySelectorAll('h1').length,prioritiesTop:document.querySelector('[aria-label="Prioridades do profissional"]')?.getBoundingClientRect().top}));
 expect(metrics.width).toBeLessThanOrEqual(width+2);expect(metrics.h1).toBe(1);
 const phase=process.env.AURA_VISUAL_PHASE||'after',dir=`.aura-integration/refinement/${phase}`;fs.mkdirSync(dir,{recursive:true});
 await page.screenshot({path:`${dir}/${name}-${width}.png`,fullPage:true});fs.writeFileSync(`${dir}/${name}-${width}.json`,JSON.stringify(metrics));
});

test('directory secondary actions work by keyboard and preserve a draft when closed',async({page})=>{
 await page.setViewportSize({width:375,height:812});await fixture(page);await page.goto('/alunos');
 const menu=page.getByLabel('Mais ações de Aluno Fictício A',{exact:true});await menu.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('button',{name:'Editar',exact:true})).toBeVisible();await page.getByRole('button',{name:'Editar',exact:true}).click();
 await page.getByLabel('Novo nome',{exact:true}).fill('Rascunho fictício preservado');await menu.click();await expect(page.getByLabel('Novo nome',{exact:true})).toHaveValue('Rascunho fictício preservado');
 page.once('dialog',d=>d.dismiss());await page.getByRole('link',{name:'Abrir ficha',exact:true}).click();await expect(page.getByLabel('Novo nome',{exact:true})).toHaveValue('Rascunho fictício preservado');
});

test('long timelines are bounded, keyboard scrollable and retain accessible provenance',async({page})=>{
 await page.setViewportSize({width:375,height:812});await fixture(page,{seedTimeline:30});await page.goto(`/alunos/${C}?org=${A}&section=timeline`);
 const region=page.getByRole('region',{name:'Registos da cronologia; desloca para consultar todo o histórico carregado',exact:true});
 await expect(region.locator('li')).toHaveCount(25);await region.focus();await page.keyboard.press('End');
 await expect.poll(()=>region.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);expect(await region.evaluate(e=>e.clientHeight)).toBeLessThanOrEqual(520);
 await page.getByRole('combobox',{name:'Tipo de registo',exact:true}).selectOption('assessment');await expect(region.getByText(/Origem: AURA/)).toBeVisible();
});

test('mobile charts keep labels readable and preserve the measurement table through resizing',async({page})=>{
 await page.setViewportSize({width:375,height:812});await fixture(page);await page.goto(`/alunos/${C}?org=${A}&section=evolution`);
 const svg=page.getByRole('img',{name:/Evolução: 1 medições/});await expect.poll(()=>svg.getAttribute('viewBox')).not.toBe('0 0 680 250');
 expect(await svg.locator('text').first().evaluate(e=>e.getBoundingClientRect().height)).toBeGreaterThan(10);
 await page.getByText('Consultar medições em tabela',{exact:true}).click();await expect(page.getByRole('table').getByRole('cell',{name:'80',exact:true})).toBeVisible();
 await page.setViewportSize({width:1440,height:1000});await expect(svg).toHaveAttribute('viewBox','0 0 680 250');
 await page.goto('/demo');await expect(page.locator('.chartbox svg')).toHaveAttribute('viewBox','0 0 680 250');
});
