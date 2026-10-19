const {test,expect}=require('@playwright/test');
const {fixture,A,B}=require('./fixtures.cjs');
for(const width of [375,1440])test(`institutional brand, tenant colors and keyboard at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await fixture(page,{seedAppointments:2});await page.goto('/');
 const logo=page.locator('.aura-sidebar').getByRole('img',{name:'AURA Business',exact:true});await expect(logo).toBeVisible();await expect(logo).toHaveJSProperty('naturalWidth',390);
 await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href','/brand/aura-favicon.svg');
 const primary=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--aura-primary').trim());expect(primary).toBe('#137F79');
 const tenant=page.locator('.brandhead');await expect(tenant).toContainText('Marca A');await expect(tenant.locator('.brandmark')).toHaveCSS('background-color','rgb(19, 127, 121)');
 await page.screenshot({path:`.aura-integration/branding/after/dashboard-${width}.png`,fullPage:true});
 if(width<901){const disclosure=page.getByText('Menu principal',{exact:true});await disclosure.focus();await page.keyboard.press('Enter');await expect(page.getByRole('link',{name:'Alunos',exact:true})).toBeVisible();}
 await page.getByRole('link',{name:'A tua marca',exact:true}).click();await page.getByLabel('Cor principal',{exact:true}).fill('#FFFFFF');
 await expect(page.locator('.brandhead .brandmark').last()).toHaveCSS('color','rgb(0, 0, 0)');await expect(logo).toHaveAttribute('src','/brand/aura-logo-on-dark.svg');
 await page.screenshot({path:`.aura-integration/branding/after/tenant-${width}.png`,fullPage:true});
 await page.getByRole('combobox',{name:/^Estabelecimento/}).selectOption(B);await expect(page.getByRole('combobox',{name:/^Estabelecimento/})).toHaveValue(B);
 await expect(logo).toHaveAttribute('src','/brand/aura-logo-on-dark.svg');
});
for(const width of [375,1440])test(`login assets and basic keyboard at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.route(/^https:\/\/[^/]+\.supabase\.co\//,route=>route.fulfill({status:401,contentType:'application/json',body:'{}'}));await page.goto('/');
 const logo=page.getByRole('img',{name:'AURA Business',exact:true});await expect(logo).toBeVisible();await expect(logo).toHaveJSProperty('naturalWidth',390);
 const icon=page.locator('.aura-login-icon');await expect(icon).toHaveAttribute('alt','');await expect(icon).toHaveJSProperty('naturalWidth',128);
 await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Saltar para o conteúdo'})).toBeFocused();await page.keyboard.press('Enter');
 await page.getByLabel('Email',{exact:true}).focus();await page.keyboard.press('Tab');await expect(page.getByLabel('Palavra-passe',{exact:true})).toBeFocused();
 await page.evaluate(()=>{document.activeElement.blur();window.scrollTo(0,0)});await page.screenshot({path:`.aura-integration/branding/after/login-${width}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('light/dark and small assets render without external requests',async({page})=>{
 const calls=[];page.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1:3187/'))calls.push(request.url())});
 await page.goto('/brand/aura-logo-on-light.svg');await expect(page.locator('svg')).toBeVisible();
 for(const name of ['aura-logo-on-dark.svg','aura-symbol.svg','aura-symbol-small.svg','aura-favicon.svg','aura-app-icon.svg']){const response=await page.request.get(`/brand/${name}`);expect(response.ok()).toBe(true);expect(response.headers()['content-type']).toContain('image/svg+xml');expect((await response.body()).length).toBeLessThan(6000);}
 expect(calls).toEqual([]);
});
