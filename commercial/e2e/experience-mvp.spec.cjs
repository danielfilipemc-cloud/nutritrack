const {test,expect}=require('@playwright/test');const {fixture,A,B}=require('./fixtures.cjs');
for(const path of ['/demo','/demo/aluno-360'])test('white label controls are consistent, contrast safe and ephemeral at '+path,async({page})=>{
 const external=[];page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:3187/'))external.push(r.url());});await page.setViewportSize({width:375,height:812});await page.goto(path);
 await page.getByRole('combobox',{name:'Identidade de exemplo',exact:true}).selectOption('light');await expect(page.locator('.brandhead')).toContainText('Estúdio Claro');
 const foreground=await page.locator('.brandmark').evaluate(el=>getComputedStyle(el).color);expect(foreground).toBe('rgb(0, 0, 0)');
 await page.getByLabel('Nome da marca',{exact:true}).fill('Estúdio Fictício com um nome comprido para validar a experiência White Label em dispositivos pequenos');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);await page.screenshot({path:'.aura-integration/mvp-'+(path.includes('360')?'360':'demo')+'-mobile.png',fullPage:true});await page.reload();await expect(page.getByRole('combobox',{name:'Identidade de exemplo',exact:true})).toHaveValue('studio');expect(external).toEqual([]);
});

test('keyboard bypass reaches the main content and the chart table opens with Enter',async({page})=>{
 await page.goto('/demo/aluno-360');await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Saltar para o conteúdo',exact:true})).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByRole('main')).toBeFocused();
 const summary=page.locator('.chartbox summary').first();await summary.focus();await page.keyboard.press('Enter');await expect(page.getByRole('table',{name:'Medições apresentadas (kg)'})).toBeVisible();
 await expect(page.getByRole('heading',{level:1})).toHaveCount(1);
});

test('professional keyboard bypass skips navigation and reaches the workspace',async({page})=>{
 await fixture(page);await page.setViewportSize({width:1440,height:1000});await page.reload();await expect(page.getByRole('heading',{name:'Visão geral',exact:true})).toBeVisible();await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Saltar para o conteúdo',exact:true})).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByRole('main')).toBeFocused();for(const label of await page.locator('.aura-nav-label-desktop').all()){const box=await label.boundingBox();expect(box.height).toBeLessThanOrEqual(28);}await page.screenshot({path:'.aura-integration/mvp-dashboard-desktop.png',fullPage:true});
});

test('brand service failure preserves establishment identity, offers retry and never keeps the prior tenant brand',async({page})=>{
 await fixture(page);let fail=true;await page.route('**/rest/v1/organization_branding?*',r=>fail?r.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'42501'})}):r.fallback());await page.goto('/?org='+A);
 await expect(page.getByRole('button',{name:'Tentar carregar marca'})).toBeVisible();await expect(page.locator('.brandhead')).toContainText('Estúdio Fictício A');fail=false;await page.getByRole('button',{name:'Tentar carregar marca'}).click();await expect(page.locator('.brandhead')).toContainText('Marca A');
 await page.getByRole('combobox',{name:/^Estabelecimento/}).selectOption(B);await expect(page.locator('.brandhead')).toContainText('Marca B');await expect(page.locator('.brandhead')).not.toContainText('Marca A');
});

test('brand controls wait for hydration instead of silently losing early interactions',async({page})=>{
 let release;const gate=new Promise(resolve=>release=resolve);await page.route(/\/_next\/static\/.*\.js$/,async route=>{await gate;await route.fallback();});
 await page.goto('/demo',{waitUntil:'commit'});const control=page.getByRole('combobox',{name:'Identidade de exemplo',exact:true});
 try{await expect(control).toBeDisabled();}finally{release();}
 await expect(control).toBeEnabled();await control.selectOption('pt');await expect(page.locator('.brandhead')).toContainText('PT Horizonte');
});
