const {defineConfig}=require('@playwright/test');
const base=require('./playwright.config.cjs');
// Never collect the historical protected-cloud harness, even with Auth enabled.
if(process.env.AURA_E2E_AUTH!=='1'||process.env.AURA_E2E_LIVE==='1'||process.env.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:57321')throw Error('Dedicated local Auth browser environment required');
module.exports=defineConfig({...base,testIgnore:undefined,testMatch:['auth-security-local.spec.cjs','auth-recovery-local.spec.cjs'],retries:0,workers:1,use:{...base.use,baseURL:'http://127.0.0.1:3187',trace:'off',screenshot:'off',video:'off'}});
