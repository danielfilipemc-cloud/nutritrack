const {defineConfig}=require('@playwright/test');
const base=require('./playwright.native-migration.config.cjs');
const url=process.env.AURA_REVISIONS_URL||'http://127.0.0.1:3201';
module.exports=defineConfig({...base,testMatch:[...base.testMatch,'demo-diary-revisions.spec.cjs'],outputDir:'.aura-integration/diary-revisions',use:{...base.use,baseURL:url},webServer:process.env.AURA_REVISIONS_URL?undefined:{command:'npm run start -- --hostname 127.0.0.1 --port 3201',url,reuseExistingServer:false,timeout:60000}});
