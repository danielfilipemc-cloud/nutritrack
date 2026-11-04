const {defineConfig,devices}=require('@playwright/test');const base=require('./playwright.config.cjs');
// Device emulation; these are not physical Android or iPhone validation.
module.exports=defineConfig({...base,testMatch:['demo-journey.spec.cjs'],outputDir:'.aura-integration/journey-device-results',workers:1,
 projects:[
  {name:'desktop-chromium',use:{browserName:'chromium',viewport:{width:1440,height:1000}}},
  ...[360,412].map(width=>({name:`android-chromium-${width}`,use:{...devices['Pixel 5'],browserName:'chromium',viewport:{width,height:900}}})),
  ...[320,390].map(width=>({name:`iphone-webkit-${width}`,use:{...devices['iPhone 13'],browserName:'webkit',viewport:{width,height:844}}})),
 ],
});
