const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const phase=process.env.AURA_FOLLOWUP_CAPTURE;
const nav=(page,width)=>page.getByRole('navigation',{name:width>800?'Navegação da demonstração':'Áreas da demonstração'});
const priorities=page=>page.locator('.aura-preview-panel').filter({has:page.getByRole('heading',{name:'Prioridades de exemplo',exact:true})});
async function area(page,width,value){if(width<=900)await page.getByRole('combobox',{name:'Área da ficha',exact:true}).selectOption(value);else await page.getByRole('button',{name:'Acompanhamento',exact:true}).click();}
for(const width of [320,375,1440])test(`followup review captures ${width}`,async({page})=>{
 test.skip(!['before','after'].includes(phase),'Explicit local review capture only');test.setTimeout(120000);
 const dir=`.aura-integration/followup/${phase}`;fs.mkdirSync(dir,{recursive:true});
 await page.setViewportSize({width,height:900});await page.goto('/demo/experiencia');
 await page.screenshot({path:`${dir}/dashboard-${width}.png`,fullPage:true});
 await priorities(page).getByRole('button').first().click();
 if(phase==='after')await expect(page.getByRole('heading',{name:'Acompanhamento do aluno',exact:true})).toBeFocused();
 await page.screenshot({path:`${dir}/priority-destination-${width}.png`,fullPage:true});
 if(phase==='before')return;
 await nav(page,width).getByRole('button',{name:'Visão geral',exact:true}).click();
 await page.getByRole('combobox',{name:'Aluno',exact:true}).selectOption('2');await nav(page,width).getByRole('button',{name:'Ficha 360.º',exact:true}).click();await area(page,width,'care');
 await page.getByLabel('Próxima revisão',{exact:true}).fill('2026-10-19');await page.getByRole('button',{name:'Guardar acompanhamento',exact:true}).click();await nav(page,width).getByRole('button',{name:'Visão geral',exact:true}).click();
 await page.screenshot({path:`${dir}/ordered-priorities-${width}.png`,fullPage:true});
 await priorities(page).getByRole('button',{name:/Abrir acompanhamento de Miguel Exemplo/}).click();await page.getByRole('combobox',{name:'Estado do acompanhamento',exact:true}).selectOption('paused');await page.getByRole('button',{name:'Guardar acompanhamento',exact:true}).click();await nav(page,width).getByRole('button',{name:'Visão geral',exact:true}).click();
 await priorities(page).getByRole('button',{name:/Abrir acompanhamento de Sofia Exemplo/}).click();await page.getByLabel('Próxima revisão',{exact:true}).fill('2026-10-25');await page.getByRole('button',{name:'Guardar acompanhamento',exact:true}).click();await nav(page,width).getByRole('button',{name:'Visão geral',exact:true}).click();
 await page.screenshot({path:`${dir}/empty-priorities-${width}.png`,fullPage:true});
});
