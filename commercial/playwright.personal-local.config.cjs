const {defineConfig}=require('@playwright/test');const base=require('./playwright.config.cjs');
if(process.env.AURA_E2E_AUTH!=='1'||process.env.AURA_E2E_LIVE==='1'||process.env.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:62321'||process.env.NEXT_PUBLIC_AURA_PERSONAL_NUTRITION!=='1')throw Error('Dedicated synthetic personal Auth target required');
module.exports=defineConfig({...base,testIgnore:undefined,testMatch:['auth-personal-local.spec.cjs'],retries:0,workers:1,timeout:120000,use:{...base.use,baseURL:'http://127.0.0.1:3187',trace:'off',screenshot:'off',video:'off'}});
