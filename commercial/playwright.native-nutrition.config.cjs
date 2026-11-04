const {defineConfig}=require('@playwright/test');
const base=require('./playwright.demo-journey.config.cjs');
module.exports=defineConfig({...base,testMatch:['demo-native-nutrition.spec.cjs','demo-nutrition.spec.cjs','demo-student-space.spec.cjs'],outputDir:'.aura-integration/native-nutrition-devices'});
