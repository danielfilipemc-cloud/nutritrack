const {test,expect}=require('@playwright/test');
test('migration inventory preserves totals, duplicate meals and explicit pending categories',async({page})=>{
 await page.goto('/demo/migracao');await expect(page.getByRole('heading',{name:'O histórico acompanha o aluno.'})).toBeVisible();
 await page.getByRole('button',{name:'Preparar inventário',exact:true}).click();await expect(page.getByRole('status')).toContainText('Inventário pronto');
 await page.locator('.migration-categories>details').filter({has:page.locator('summary',{hasText:'Diário alimentar'})}).locator('summary').first().click();
 await expect(page.getByText('Refeição inválida ou com campos não suportados.')).toHaveCount(0);
 const meals=page.locator('.migration-categories>details').filter({has:page.locator('summary',{hasText:'Diário alimentar'})});await expect(meals.locator('article')).toHaveCount(2);
 await meals.getByText('Ver valores de origem e destino',{exact:true}).first().click();await expect(meals.locator('pre').first()).toContainText('"composition": null');await expect(meals.locator('pre').first()).toContainText('"calories": 76');
 await page.getByRole('button',{name:'Ensaiar receção neste aluno'}).click();await expect(page.getByRole('status')).toContainText('pendências preservadas');
 await page.getByRole('button',{name:'Ensaiar receção neste aluno'}).click();await expect(page.getByRole('status')).toContainText('0 registos novos');
});
test('re-export replays, changed backup blocks overwrite and target receipts remain isolated',async({page})=>{
 await page.goto('/demo/migracao');await page.getByRole('button',{name:'Preparar inventário',exact:true}).click();await page.getByRole('button',{name:'Ensaiar receção neste aluno'}).click();
 const first=await page.locator('.migration-receipt code').textContent();
 await page.getByLabel('Backup de exemplo').selectOption('reordered');await page.getByRole('button',{name:'Preparar inventário',exact:true}).click();await page.getByRole('button',{name:'Ensaiar receção neste aluno'}).click();await expect(page.getByRole('status')).toContainText('Repetição reconhecida');
 await page.getByLabel('Backup de exemplo').selectOption('changed');await page.getByRole('button',{name:'Preparar inventário',exact:true}).click();await page.getByRole('button',{name:'Ensaiar receção neste aluno'}).click();await expect(page.getByRole('status')).toContainText('Conflito');await expect(page.locator('.migration-receipt code')).toHaveText(first);
 await page.getByLabel('Destino fictício').selectOption('aluno-exemplo-b');await expect(page.locator('.migration-receipt')).toHaveCount(0);await page.getByRole('button',{name:'Ensaiar receção neste aluno'}).click();await expect(page.getByRole('status')).toContainText('Ensaio registado');
 await page.getByLabel('Destino fictício').selectOption('aluno-exemplo-a');await expect(page.locator('.migration-receipt code')).toHaveText(first);
 await page.reload();await expect(page.locator('.migration-receipt')).toHaveCount(0);await expect(page.getByRole('button',{name:'Ensaiar receção neste aluno'})).toHaveCount(0);
});
test('synthetic laboratory has no private requests, file uploads or browser storage and fits the viewport',async({page})=>{
 const privateRequests=[];page.on('request',r=>{if(/supabase|\/rest\/v1|\/auth\/v1|\/api\//.test(r.url()))privateRequests.push(r.url());});
 await page.addInitScript(()=>{for(const proto of [Storage.prototype])for(const method of ['getItem','setItem','removeItem','clear'])proto[method]=()=>{throw Error('Laboratory must not access browser storage');};});
 await page.goto('/demo/migracao');await expect(page.locator('input[type=file]')).toHaveCount(0);await page.getByRole('button',{name:'Preparar inventário',exact:true}).click();await expect(page.getByRole('status')).toContainText('Inventário pronto');
 await page.getByRole('button',{name:'Ensaiar receção neste aluno'}).click();expect(privateRequests).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 const categories=page.locator('.migration-categories>details');for(let i=0;i<await categories.count();i++){await categories.nth(i).locator('summary').first().click();}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test('keyboard focus and disclosure remain usable through reconciliation',async({page})=>{
 await page.goto('/demo/migracao');const prepare=page.getByRole('button',{name:'Preparar inventário',exact:true});await prepare.focus();await page.keyboard.press('Enter');await expect(page.getByRole('status')).toContainText('Inventário pronto');
 const summary=page.locator('.migration-categories>details>summary').first();await summary.focus();await page.keyboard.press('Enter');await expect(summary.locator('..')).toHaveAttribute('open','');
 await page.keyboard.press('Space');await expect(summary.locator('..')).not.toHaveAttribute('open','');
 await page.getByRole('button',{name:'Ensaiar receção neste aluno'}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('status')).toContainText('Ensaio registado');
});
test('scenario controls lock while asynchronous inventory hashing is pending',async({page})=>{
 await page.addInitScript(()=>{const original=SubtleCrypto.prototype.digest;SubtleCrypto.prototype.digest=async function(...args){await new Promise(r=>setTimeout(r,20));return original.apply(this,args);};});
 await page.goto('/demo/migracao');await page.getByRole('button',{name:'Preparar inventário',exact:true}).click();
 await expect(page.getByLabel('Backup de exemplo')).toBeDisabled();await expect(page.getByLabel('Destino fictício')).toBeDisabled();
 await expect(page.getByRole('status')).toContainText('Inventário pronto');await expect(page.getByLabel('Backup de exemplo')).toBeEnabled();
});
