const {test,expect}=require('@playwright/test');
const {fixture,A,B,C}=require('./fixtures.cjs');
async function open(page){await fixture(page);await page.goto(`/alunos/${C}?org=${A}&section=nutrition`);await page.getByRole('button',{name:'Ensaiar registo',exact:true}).click();}
const amount=page=>page.getByLabel('Quantidade do registo fictício (g)');
async function review(page,outcome='success'){await page.getByRole('button',{name:'Rever exemplo',exact:true}).click();await page.getByLabel('Cenário do ensaio').selectOption(outcome);await page.getByRole('button',{name:'Confirmar apenas no ensaio',exact:true}).click();}
test('synthetic entry, correction and void retain history without any nutrition network calls',async({page})=>{
 const calls=[];page.on('request',r=>{if(/rest\/v1\/.*(nutrition|food|meal)/i.test(r.url()))calls.push(r.url());});
 await open(page);await amount(page).fill('125.5');await review(page);await expect(page.getByText('Revisão 1 · Cereal de exemplo: 125.5 g',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Corrigir exemplo',exact:true}).click();await amount(page).fill('75');await review(page);await expect(page.getByText('Revisão 2 · Cereal de exemplo: 75 g',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Rever anulação fictícia',exact:true}).click();await page.getByRole('button',{name:'Confirmar apenas no ensaio',exact:true}).click();
 await expect(page.getByText('Anulação fictícia confirmada; o histórico foi preservado.',{exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'Histórico do ensaio'}).getByRole('listitem')).toHaveCount(3);expect(calls).toEqual([]);
 await page.getByRole('button',{name:'Resumo alimentar',exact:true}).click();await page.getByRole('button',{name:'Ensaiar registo',exact:true}).click();await expect(page.getByRole('region',{name:'Histórico do ensaio'})).toHaveCount(0);
});
test('simulated conflict preserves the draft and never creates a history version',async({page})=>{
 await open(page);await amount(page).fill('80');await review(page,'conflict');await expect(page.getByRole('alert')).toContainText('rascunho mantém-se');
 await expect(page.getByRole('region',{name:'Histórico do ensaio'})).toHaveCount(0);await page.getByRole('button',{name:'Rever rascunho preservado',exact:true}).click();await expect(amount(page)).toHaveValue('80');
});
test('uncertain outcome prevents blind retry and receipt check creates no duplicate version',async({page})=>{
 await open(page);await amount(page).fill('50');await review(page,'uncertain');await expect(page.getByRole('alert')).toContainText('Não repetir');await expect(page.getByRole('button',{name:'Confirmar apenas no ensaio'})).toHaveCount(0);
 await page.getByRole('button',{name:'Verificar resultado simulado',exact:true}).click();await expect(page.getByRole('region',{name:'Histórico do ensaio'}).getByRole('listitem')).toHaveCount(1);
});
test('entry draft guards section, organization, logout and reload and cannot leak into another organization',async({page})=>{
 await open(page);await amount(page).fill('85');page.on('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Resumo alimentar',exact:true}).click();await expect(amount(page)).toHaveValue('85');
 await page.getByRole('combobox',{name:/^Estabelecimento/}).selectOption(B);await expect(page.getByRole('combobox',{name:/^Estabelecimento/})).toHaveValue(A);await expect(amount(page)).toHaveValue('85');
 await page.getByRole('button',{name:'Terminar sessão',exact:true}).click();await expect(amount(page)).toHaveValue('85');
 const reloadDialog=page.waitForEvent('dialog');const cdp=await page.context().newCDPSession(page);await cdp.send('Page.reload');await reloadDialog;await cdp.detach();await expect(amount(page)).toHaveValue('85');
 page.removeAllListeners('dialog');page.on('dialog',d=>d.accept());await page.getByRole('combobox',{name:/^Estabelecimento/}).selectOption(B);await expect(page.getByRole('region',{name:'Ensaio de registo nutricional'})).toHaveCount(0);
});
for(const width of [320,1440])test(`P5 keyboard review and visual evidence at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await open(page);await amount(page).fill('75');const button=page.getByRole('button',{name:'Rever exemplo',exact:true});await button.focus();await page.keyboard.press('Enter');await expect(page.getByRole('region',{name:'Revisão do exemplo'})).toBeVisible();
 await page.evaluate(()=>window.scrollTo(0,0));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`.aura-integration/nutrition-p5/${width}-review.png`,fullPage:true});
});
