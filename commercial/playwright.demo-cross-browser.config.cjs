const {defineConfig}=require('@playwright/test');
const base=require('./playwright.config.cjs');
// Local fixtures only. WebKit on Linux does not constitute Safari/iOS validation.
module.exports=defineConfig({...base,
 testMatch:['demo-mobile-flow.spec.cjs','demo-navigation.spec.cjs','premium-demo.spec.cjs','demo-appointments.spec.cjs','demo-appointment-lifecycle.spec.cjs','demo-followup.spec.cjs','demo-followup-captures.spec.cjs'],
 outputDir:'test-results/demo-cross-browser',
 projects:['chromium','firefox','webkit'].map(browserName=>({name:browserName,use:{browserName}})),
});
