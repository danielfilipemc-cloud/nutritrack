const {test,expect}=require('@playwright/test');
const nav=p=>p.getByRole('navigation',{name:p.viewportSize().width>800?'Navegação da demonstração':'Áreas da demonstração'});
const top=(p,name)=>nav(p).getByRole('button',{name,exact:true}).click();
async function area(p,key){if(p.viewportSize().width<=900)await p.getByRole('combobox',{name:'Área da ficha',exact:true}).selectOption(key);else await p.getByRole('navigation',{name:'Secções da ficha',exact:true}).getByRole('button',{name:{nutrition:'Nutrição',student:'Experiência do aluno',overview:'Resumo'}[key],exact:true}).click();}
const composer=p=>p.getByRole('form',{name:'Refeição do plano',exact:true});
const foodtab=(p,name)=>p.getByRole('navigation',{name:'Áreas de nutrição do aluno',exact:true}).getByRole('button',{name,exact:true}).click();
async function start(p){await p.goto('/demo/experiencia');await expect(p.locator('main')).toHaveAttribute('aria-busy','false');await top(p,'Ficha 360.º');await area(p,'nutrition');}
async function build(p){const f=composer(p);await f.getByLabel('Nome da refeição',{exact:true}).fill('Jantar composto AURA');await f.getByLabel('Hora da refeição',{exact:true}).fill('18:30');await f.getByRole('button',{name:'Adicionar alimento à refeição',exact:true}).click();await f.getByRole('combobox',{name:'Alimento adicional 1',exact:true}).selectOption('iogurte');await f.getByLabel('Quantidade adicional 1 (g)',{exact:true}).fill('125');await f.getByRole('button',{name:'Adicionar alimento à refeição',exact:true}).click();await f.getByLabel('Quantidade adicional 2 (g)',{exact:true}).fill('150');}
test.beforeEach(()=>test.setTimeout(90000));
test('complete native nutrition loop preserves composition from professional to student diary and review',async({page})=>{
 const outside=[];page.on('request',r=>{const u=new URL(r.url());if(/supabase|\/rest\/v1|\/auth\/v1/.test(u.href))outside.push(u.origin+u.pathname);});
 await start(page);await build(page);await expect(page.getByRole('region',{name:'Composição do rascunho',exact:true})).toContainText('272,25');
 await composer(page).getByRole('button',{name:'Guardar refeição fictícia',exact:true}).click();await page.getByRole('button',{name:'Disponibilizar plano alimentar',exact:true}).click();
 await area(page,'student');await page.getByRole('navigation',{name:'Navegação do espaço do aluno',exact:true}).getByRole('button',{name:'Alimentação',exact:true}).click();
 const meal=page.locator('.aura-student-meal-list>li').filter({has:page.getByRole('heading',{name:'Jantar composto AURA',exact:true})});await expect(meal).toContainText('Iogurte de exemplo');await expect(meal).toContainText('125 g');await expect(meal).toContainText('150 g');
 await meal.getByRole('button',{name:'Registar esta refeição · Jantar composto AURA',exact:true}).click();await expect(page.getByRole('combobox',{name:'Refeição a registar',exact:true})).toBeFocused();
 await page.getByLabel('Nota do aluno simulado (opcional)',{exact:true}).fill('Exemplo completo dentro do AURA');await page.getByRole('button',{name:'Guardar registo fictício',exact:true}).click();
 await expect(page.getByRole('status')).toBeFocused();await expect(page.locator('.aura-student-diary')).toContainText('272,25');
 await page.getByRole('button',{name:'Voltar à ficha profissional',exact:true}).click();await area(page,'nutrition');await foodtab(page,'Diário e histórico');
 const row=page.locator('.aura-demo-nutrition-meals>li').filter({has:page.getByRole('heading',{name:'Registo alimentar #2 · Jantar composto AURA',exact:true})});await expect(row).toContainText('Iogurte de exemplo');await row.getByRole('button',{name:'Rever registo alimentar #2',exact:true}).click();await row.getByRole('button',{name:'Criar ação do registo alimentar #2',exact:true}).click();await expect(row).toContainText('Ação ligada ao acompanhamento.');
 await foodtab(page,'Plano de exemplo');await page.getByRole('button',{name:'Editar refeição: Jantar composto AURA às 18:30',exact:true}).click();await composer(page).getByLabel('Quantidade adicional 1 (g)',{exact:true}).fill('300');await composer(page).getByRole('button',{name:'Guardar refeição fictícia',exact:true}).click();await foodtab(page,'Diário e histórico');await expect(row).toContainText('125 g');await expect(row).not.toContainText('300 g');expect(outside).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('ingredient drafts stay with the student across areas and discard clears the dirty state',async({page})=>{
 await start(page);await build(page);await area(page,'overview');await area(page,'nutrition');await expect(composer(page).getByLabel('Quantidade adicional 1 (g)',{exact:true})).toHaveValue('125');
 await page.getByRole('combobox',{name:'Escolher aluno',exact:true}).selectOption('2');await expect(composer(page).getByRole('combobox',{name:'Alimento adicional 1',exact:true})).toHaveCount(0);await page.getByRole('combobox',{name:'Escolher aluno',exact:true}).selectOption('1');await expect(composer(page).getByLabel('Quantidade adicional 2 (g)',{exact:true})).toHaveValue('150');
 await composer(page).getByRole('button',{name:'Remover alimento adicional 1',exact:true}).click();await expect(composer(page).getByRole('button',{name:'Adicionar alimento à refeição',exact:true})).toBeFocused();await expect(composer(page).getByLabel('Quantidade adicional 1 (g)',{exact:true})).toHaveValue('150');
 await composer(page).getByRole('button',{name:'Descartar rascunho desta refeição',exact:true}).click();await expect(composer(page).getByRole('combobox',{name:'Alimento adicional 1',exact:true})).toHaveCount(0);await expect(page.getByText('O editor não tem alterações por guardar.',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('clearing an added quantity retains draft and never displays an invented zero total',async({page})=>{
 await start(page);await build(page);await composer(page).getByLabel('Quantidade adicional 1 (g)',{exact:true}).fill('');await expect(page.getByRole('region',{name:'Composição do rascunho',exact:true})).toContainText('Completa as quantidades');await composer(page).getByRole('button',{name:'Guardar refeição fictícia',exact:true}).click();await expect(composer(page).getByLabel('Quantidade adicional 1 (g)',{exact:true})).toHaveValue('');await expect(page.getByRole('button',{name:'Disponibilizar plano alimentar',exact:true})).toBeDisabled();
 await composer(page).getByRole('button',{name:'Descartar rascunho desta refeição',exact:true}).click();const add=composer(page).getByRole('button',{name:'Adicionar alimento à refeição',exact:true});await add.click();await composer(page).getByRole('button',{name:'Remover alimento adicional 1',exact:true}).click();await expect(page.getByText('O editor não tem alterações por guardar.',{exact:true})).toBeVisible();
});

test('eight-food limit and removal transfer keyboard focus to enabled controls',async({page})=>{
 await start(page);const f=composer(page),add=f.getByRole('button',{name:'Adicionar alimento à refeição',exact:true});
 for(let n=1;n<=7;n++){await add.click();await expect(f.getByRole('combobox',{name:`Alimento adicional ${n}`,exact:true})).toBeFocused();}
 await expect(add).toBeDisabled();await f.getByRole('button',{name:'Remover alimento adicional 7',exact:true}).click();await expect(add).toBeEnabled();await expect(add).toBeFocused();
 await add.click();await expect(f.getByRole('combobox',{name:'Alimento adicional 7',exact:true})).toBeFocused();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
