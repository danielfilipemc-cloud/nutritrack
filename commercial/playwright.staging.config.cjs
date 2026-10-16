const {defineConfig,devices}=require('@playwright/test');
if(process.env.AURA_STAGING_BROWSER_CONFIRM!=='vgbwmamntjmhzrpvhxzb')throw Error('Explicit synthetic staging confirmation required');
module.exports=defineConfig({testDir:'./e2e',testMatch:'auth-online-staging.spec.cjs',workers:1,retries:0,reporter:'list',timeout:90000,use:{baseURL:'https://aura-business-staging.onrender.com',trace:'off',screenshot:'off',video:'off'},projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}]});
