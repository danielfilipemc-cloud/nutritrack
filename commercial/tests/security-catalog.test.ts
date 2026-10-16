import {test} from 'node:test';
import assert from 'node:assert/strict';
import {foundationFixture} from './foundation-fixture';

test('upgraded catalog exposes no privileged RPC, anonymous private function or historical bypass',async()=>{
 const {db}=await foundationFixture();
 try{
  const exposed=await db.query<{name:string;definer:boolean;anonymous:boolean}>(`
   select p.proname name,p.prosecdef definer,has_function_privilege('anon',p.oid,'execute') anonymous
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname like 'aura_%'`);
  assert.ok(exposed.rows.length>20,'must inspect the installed API, not an empty catalog');
  for(const fn of exposed.rows){assert.equal(fn.definer,false,fn.name);assert.equal(fn.anonymous,false,fn.name);}
  const privateFunctions=await db.query<{name:string;definer:boolean;config:string[]|null;anonymous:boolean;authenticated:boolean}>(`
   select p.proname name,p.prosecdef definer,p.proconfig config,
    has_function_privilege('anon',p.oid,'execute') anonymous,
    has_function_privilege('authenticated',p.oid,'execute') authenticated
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private'`);
  assert.ok(privateFunctions.rows.some(fn=>fn.name.endsWith('_foundation_base')));
  for(const fn of privateFunctions.rows){
   assert.equal(fn.anonymous,false,fn.name);
   if(fn.definer)assert.ok(fn.config?.includes('search_path=""'),fn.name+' must fix an empty search_path');
   if(fn.name.endsWith('_foundation_base'))assert.equal(fn.authenticated,false,fn.name);
  }
  const unprotected=await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname in ('public','app_private') and c.relkind='r' and not c.relrowsecurity`);
  assert.deepEqual(unprotected.rows,[],'all application tables must retain RLS');
 }finally{await db.close();}
});
