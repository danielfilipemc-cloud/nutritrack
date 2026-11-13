const {test,expect}=require('@playwright/test');

test('installable manifest and PNG icons are public, scoped and free from identity data',async({page,request})=>{
 const response=await request.get('/manifest.webmanifest');expect(response.ok()).toBeTruthy();
 const manifest=await response.json();expect(manifest).toMatchObject({id:'/',name:'AURA Business',start_url:'/',scope:'/',display:'standalone',theme_color:'#137F79'});
 for(const icon of manifest.icons){const png=await request.get(icon.src);expect(png.ok()).toBeTruthy();expect(png.headers()['content-type']).toContain('image/png');const bytes=await png.body();const n=Number(icon.sizes.split('x')[0]);expect(bytes.readUInt32BE(16)).toBe(n);expect(bytes.readUInt32BE(20)).toBe(n);expect(bytes.length).toBeLessThan(100000);}
 await page.goto('/instalar');await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href','/manifest.webmanifest');
 expect(await page.evaluate(async()=>navigator.serviceWorker?(await navigator.serviceWorker.getRegistrations()).length:0)).toBe(0);
});

test('Android install instructions remain available without an install prompt at 320px',async({page})=>{
 await page.setViewportSize({width:320,height:800});await page.goto('/instalar');
 await expect(page.getByRole('heading',{name:'AURA contigo'})).toBeVisible();await expect(page.getByText('Instalar aplicação',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Instalar AURA',exact:true})).toHaveCount(0);
 await expect(page.getByText('É necessária ligação à internet.')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:'.aura-integration/mobile-install-320.png',fullPage:true});
});

test('install prompt uses one user action and handles dismissal without claiming installation',async({page})=>{
 await page.goto('/instalar');
 await page.evaluate(()=>{window.__installCalls=0;const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{window.__installCalls++;};event.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(event);});
 await page.getByRole('button',{name:'Instalar AURA',exact:true}).click();await expect(page.getByRole('status')).toContainText('Instalação cancelada');
 expect(await page.evaluate(()=>window.__installCalls)).toBe(1);await expect(page.getByText('A aplicação está aberta em modo instalado.')).toHaveCount(0);
});

test('installation failure remains recoverable and installed state is explicit',async({page})=>{
 await page.goto('/instalar');await page.evaluate(()=>{const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{throw Error('synthetic failure');};event.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(event);});
 await page.getByRole('button',{name:'Instalar AURA',exact:true}).click();await expect(page.getByRole('status')).toContainText('Usa o menu do Chrome');
 await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));await expect(page.getByText('A aplicação está aberta em modo instalado.')).toBeVisible();
});

test('installation page keeps keyboard navigation and desktop layout usable',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await page.goto('/instalar');await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Saltar para o conteúdo'})).toBeFocused();await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Voltar à AURA'})).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:'.aura-integration/mobile-install-desktop.png',fullPage:true});
});
