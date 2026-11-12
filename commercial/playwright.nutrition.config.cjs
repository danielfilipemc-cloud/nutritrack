const {defineConfig}=require('@playwright/test');const base=require('./playwright.config.cjs');
if(process.env.NEXT_PUBLIC_AURA_NATIVE_NUTRITION!=='1'||process.env.AURA_E2E_LIVE==='1')throw Error('Explicit native nutrition local build required');
module.exports=defineConfig({...base,testMatch:'nutrition-native.spec.cjs',retries:0});
