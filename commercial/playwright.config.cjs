const {defineConfig,devices}=require('@playwright/test');
const live=process.env.AURA_E2E_LIVE==='1';
module.exports=defineConfig({
 testDir:'./e2e',testIgnore:process.env.AURA_E2E_AUTH==='1'?undefined:'**/auth*.spec.cjs',fullyParallel:true,forbidOnly:!!process.env.CI,retries:process.env.CI?1:0,
 reporter:'list',workers:process.env.CI?2:undefined,
 use:{baseURL:live?'https://aura-business-demo.onrender.com':'http://127.0.0.1:3187',trace:'retain-on-failure'},
 projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
 webServer:live?undefined:{command:'npm run start -- --hostname 127.0.0.1 --port 3187',url:'http://127.0.0.1:3187',reuseExistingServer:false,timeout:60000,env:{NEXT_TELEMETRY_DISABLED:'1'}},
});
