const {defineConfig}=require('@playwright/test');
const base=require('./playwright.diary-revisions.config.cjs');
const url=process.env.AURA_SHOPPING_URL||'http://127.0.0.1:3202';
module.exports=defineConfig({...base,testMatch:[...base.testMatch,'demo-nutrition-shopping.spec.cjs'],outputDir:'.aura-integration/nutrition-shopping',use:{...base.use,baseURL:url},webServer:process.env.AURA_SHOPPING_URL?undefined:{command:'npm run start -- --hostname 127.0.0.1 --port 3202',url,reuseExistingServer:false,timeout:60000}});
