const {expect}=require('@playwright/test');
async function openPriorities(page){
 const disclosure=page.locator('.aura-home-priorities');await expect(disclosure).toBeVisible();
 if(!await disclosure.evaluate(el=>el.open))await disclosure.locator(':scope>summary').click();
 return page.getByRole('region',{name:'Prioridades do profissional',exact:true});
}
module.exports={openPriorities};
