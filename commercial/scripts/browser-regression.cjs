const {execFileSync}=require('node:child_process');const path=require('node:path');
// Existing CI calls this package script. No service, secret, migration or live mode.
if(process.env.AURA_E2E_LIVE==='1'||process.env.AURA_E2E_AUTH==='1')throw Error('Use the dedicated approved Auth/staging runners');
const root=path.resolve(__dirname,'..'),cli=path.join(root,'node_modules/@playwright/test/cli.js'),next=path.join(root,'node_modules/next/dist/bin/next');
const run=(bin,args,env)=>execFileSync(process.execPath,[bin,...args],{cwd:root,env,stdio:'inherit'});
const args=process.argv.slice(2);
if(args.length){run(cli,['test',...args],process.env);process.exit(0);}
const base={...process.env,NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:'https://aura-test.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_e2e_fixture',NEXT_PUBLIC_AURA_NATIVE_NUTRITION:'0',NEXT_PUBLIC_AURA_PERSONAL_NUTRITION:'0'};
let failure=null;
try{const native={...base,NEXT_PUBLIC_AURA_NATIVE_NUTRITION:'1',NEXT_PUBLIC_AURA_PERSONAL_NUTRITION:'1'};run(next,['build'],native);run(cli,['test','--config','playwright.nutrition.config.cjs','--workers=2'],native);}catch(e){failure=e;}
// Restore the normal fixture artifact even when the native regression fails.
run(next,['build'],base);if(failure)throw failure;run(cli,['test','--workers=2'],base);
