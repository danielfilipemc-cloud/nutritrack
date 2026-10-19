const {test,expect}=require('@playwright/test');
const fs=require('node:fs');const {fixture,A,C}=require('./fixtures.cjs');
const evidence='.aura-integration/integration-pr25-26';
fs.mkdirSync(evidence,{recursive:true});
async function chartMetrics(svg){return svg.evaluate(el=>{const box=el.getBoundingClientRect();return {width:box.width,viewBox:el.getAttribute('viewBox'),labels:[...el.querySelectorAll('text')].map(t=>{const b=t.getBoundingClientRect();return {text:t.textContent,height:b.height,inside:b.left>=box.left-1&&b.right<=box.right+1};})};});}
test('chart below 320 CSS pixels preserves labels and keyboard-accessible values',async({page})=>{
 await page.setViewportSize({width:320,height:812});await fixture(page);await page.goto(`/alunos/${C}?org=${A}&section=evolution`);
 const svg=page.getByRole('img',{name:/Evolução: 1 medições/});await expect(svg).toHaveAttribute('viewBox','0 0 320 250');
 const metrics=await chartMetrics(svg);expect(metrics.width).toBeLessThan(320);expect(metrics.labels.every(l=>l.inside)).toBe(true);
 const overflow=await svg.evaluate(el=>({scroll:el.parentElement.scrollWidth,client:el.parentElement.clientWidth}));expect(overflow.scroll).toBeLessThanOrEqual(overflow.client+1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 const summary=page.getByText('Consultar medições em tabela',{exact:true});await summary.focus();await page.keyboard.press('Enter');await expect(page.getByRole('table').getByRole('cell',{name:'80',exact:true})).toBeVisible();
 fs.writeFileSync(`${evidence}/narrow-chart.json`,JSON.stringify(metrics,null,2));await page.screenshot({path:`${evidence}/narrow-chart.png`,fullPage:true});
});
test('chart at 200 percent CSS zoom preserves table and remains in its container',async({page})=>{
 await page.setViewportSize({width:1280,height:1000});await fixture(page);await page.goto(`/alunos/${C}?org=${A}&section=evolution`);
 await page.getByRole('img',{name:/Evolução: 1 medições/}).waitFor();await page.evaluate(()=>{document.documentElement.style.zoom='2';});
 await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.documentElement).zoom)).toBe('2');
 const svg=page.getByRole('img',{name:/Evolução: 1 medições/});await expect.poll(()=>svg.getAttribute('viewBox')).not.toBe('0 0 680 250');
 const metrics=await chartMetrics(svg);expect(metrics.labels.every(l=>l.inside)).toBe(true);
 const summary=page.getByText('Consultar medições em tabela',{exact:true});await summary.focus();await page.keyboard.press('Enter');await expect(page.getByRole('table').getByRole('cell',{name:'80',exact:true})).toBeVisible();
 fs.writeFileSync(`${evidence}/zoom-200.json`,JSON.stringify({kind:'CSS zoom; not native browser UI zoom',...metrics},null,2));await page.screenshot({path:`${evidence}/zoom-200.png`,fullPage:true});
});
test('mobile timeline permits keyboard scrolling loading more and exit',async({page})=>{
 await page.setViewportSize({width:375,height:812});await fixture(page,{seedTimeline:30});await page.goto(`/alunos/${C}?org=${A}&section=timeline`);
 const timeline=page.getByRole('region',{name:'Cronologia integrada do aluno',exact:true});const list=page.getByRole('region',{name:'Registos da cronologia; desloca para consultar todo o histórico carregado',exact:true});
 await expect(list.locator('li')).toHaveCount(25);await list.focus();await page.keyboard.press('End');await expect.poll(()=>list.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
 // Keyboard traversal must reach the load command without a pointer or focus trap.
 let reached=false;for(let n=0;n<35;n++){await page.keyboard.press('Tab');if(await timeline.getByRole('button',{name:'Carregar mais registos',exact:true}).evaluate(el=>el===document.activeElement)){reached=true;break;}}expect(reached).toBe(true);
 await page.keyboard.press('Enter');await expect(list.locator('li')).toHaveCount(31);await expect(list.locator('li').nth(25).getByRole('link')).toBeFocused();const focusAfterLoad=await page.evaluate(()=>({tag:document.activeElement.tagName,text:document.activeElement===document.body?'body':document.activeElement.textContent.slice(0,100)}));expect(focusAfterLoad.tag).not.toBe('BODY');await list.focus();await page.keyboard.press('End');
 expect(await list.evaluate(el=>el===document.activeElement)).toBe(true);await page.keyboard.press('Shift+Tab');expect(await list.evaluate(el=>el===document.activeElement)).toBe(false);
 fs.writeFileSync(`${evidence}/timeline-mobile.json`,JSON.stringify({loaded:31,keyboardLoad:true,keyboardExit:true,focusAfterLoad}));await page.screenshot({path:`${evidence}/timeline-mobile.png`,fullPage:true});
});
test('dashboard and directory disclosures are discoverable and operable without a pointer',async({page})=>{
 await page.setViewportSize({width:375,height:812});await fixture(page);const summary=page.locator('.aura-dashboard-secondary>summary').first();
 await expect(summary).toBeVisible();await summary.focus();await page.keyboard.press('Enter');await expect(page.getByText('Sem avaliações recentes',{exact:true})).toBeVisible();await page.keyboard.press('Space');await expect(page.getByText('Sem avaliações recentes',{exact:true})).toBeHidden();await expect(page.getByRole('link',{name:'Abrir ficha de Aluno Fictício A',exact:true})).toBeVisible();
 await page.goto('/alunos');const menu=page.getByLabel('Mais ações de Aluno Fictício A',{exact:true});await expect(menu).toBeVisible();await menu.focus();await page.keyboard.press('Enter');await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Editar',exact:true})).toBeFocused();
});

test('a delayed timeline page does not steal focus after the user moves to a filter',async({page})=>{
 await page.setViewportSize({width:375,height:812});await fixture(page,{seedTimeline:30});await page.goto(`/alunos/${C}?org=${A}&section=timeline`);
 const list=page.locator('.aura-timeline');await expect(list.locator(':scope>li')).toHaveCount(25);
 let release,started=false;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/rpc/aura_client_timeline',async route=>{if(route.request().postDataJSON().p_before){started=true;await gate;}return route.fallback();});
 await page.getByRole('button',{name:'Carregar mais registos',exact:true}).click();await expect.poll(()=>started).toBe(true);
 const filter=page.getByRole('combobox',{name:'Tipo de registo',exact:true});await filter.focus();release();await expect(list.locator(':scope>li')).toHaveCount(31);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await expect(filter).toBeFocused();
});
