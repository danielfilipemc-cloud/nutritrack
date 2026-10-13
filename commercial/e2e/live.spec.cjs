const {test,expect}=require('@playwright/test');
test('live demo renders',async({page})=>{const r=await page.goto('https://aura-business-demo.onrender.com/demo');expect(r.status()).toBe(200);await expect(page.getByRole('heading',{name:/Mais proximidade/})).toBeVisible();});
