const {test,expect}=require('@playwright/test');const {fixture,A,B,C,today}=require('./fixtures.cjs');
const profile=section=>`/alunos/${C}?org=${A}&section=${section}`;

test('assessment drafts survive cancelled section and organization changes, with explicit discard',async({page})=>{
 await fixture(page);await page.goto(profile('assessments'));const weight=page.getByLabel('Peso (kg)',{exact:true});await weight.fill('77.35');
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Objetivos',exact:true}).click();await expect(weight).toHaveValue('77.35');await expect(page).toHaveURL(/section=assessments/);
 page.once('dialog',d=>d.dismiss());await page.getByRole('combobox',{name:/^Estabelecimento/}).selectOption(B);await expect(page.getByRole('combobox',{name:/^Estabelecimento/})).toHaveValue(A);await expect(weight).toHaveValue('77.35');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Objetivos',exact:true}).click();await expect(page).toHaveURL(/section=objectives/);await page.getByRole('button',{name:'Avaliações',exact:true}).click();await expect(weight).toHaveValue('');
});

test('selected profile section survives reload and imports stay in the existing profile',async({page})=>{
 await fixture(page);await page.goto(profile('overview'));await page.getByRole('button',{name:'Evolução',exact:true}).click();await expect(page).toHaveURL(/section=evolution/);await page.reload();await expect(page.getByRole('button',{name:'Evolução',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Treino, nutrição e comunicação',exact:true}).click();await expect(page).toHaveURL(/section=integrations/);await page.reload();await expect(page.getByRole('heading',{name:/NutriTrack/}).first()).toBeVisible();
 await expect(page.getByRole('link',{name:'Diretório de alunos'})).toHaveAttribute('href','/alunos?org='+A);
});

test('profile lookup network errors can retry without disguising a service failure as missing pupil',async({page})=>{
 await fixture(page);let fail=true;await page.route('**/rest/v1/clients?*',r=>fail&&r.request().url().includes('id=eq.')?r.abort('failed'):r.fallback());await page.goto(profile('overview'));
 await expect(page.getByRole('button',{name:'Tentar abrir ficha'})).toBeVisible({timeout:15000});await expect(page.getByRole('heading',{name:'Aluno Fictício A',exact:true})).toHaveCount(0);
 fail=false;await page.getByRole('button',{name:'Tentar abrir ficha'}).click();await expect(page.getByRole('heading',{name:'Aluno Fictício A',exact:true})).toBeVisible();
});

test('failed permissions load exposes no edit controls and can be revalidated',async({page})=>{
 await fixture(page);let fail=true;await page.route('**/rpc/aura_client_permissions',r=>fail?r.abort('failed'):r.fallback());await page.goto(profile('assessments'));
 await expect(page.getByRole('alert').filter({hasText:'Não foi possível verificar as permissões'})).toBeVisible();await expect(page.getByRole('button',{name:'Guardar avaliação'})).toHaveCount(0);
 fail=false;await page.getByRole('button',{name:'Tentar verificar permissões'}).click();await expect(page.getByRole('button',{name:'Guardar avaliação'})).toBeEnabled();
});

test('assessment history preserves NutriTrack source revision alongside the assessment revision',async({page})=>{
 await fixture(page);await page.route('**/rest/v1/assessments?*',r=>r.fulfill({status:200,contentType:'application/json',headers:{'content-range':'0-0/1'},body:JSON.stringify([{id:'source-synthetic',assessed_on:today,weight_kg:80,height_cm:null,waist_cm:85,revision:2,student_visible:false,superseded_at:null,source_system:'nutritrack',source_revision:3}])}));await page.goto(profile('assessments'));
 await expect(page.getByRole('cell',{name:'NutriTrack · revisão 3',exact:true})).toBeVisible();await expect(page.getByText('Versão 2',{exact:false}).first()).toBeVisible();
});

test('assessment picker cannot silently discard a draft when deselecting the student',async({page})=>{
 await fixture(page);await page.goto('/avaliacoes?org='+A+'&aluno='+C);await page.getByLabel('Peso (kg)',{exact:true}).fill('76.25');
 page.once('dialog',d=>d.dismiss());await page.getByRole('combobox',{name:'Aluno',exact:true}).selectOption('');await expect(page.getByRole('combobox',{name:'Aluno',exact:true})).toHaveValue(C);await expect(page.getByLabel('Peso (kg)',{exact:true})).toHaveValue('76.25');
});
