import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseWaterCommandV1} from '../lib/nutrition-water-command';
import {createNutritionWaterPersistence} from '../lib/nutrition-water-persistence';
import {NutritionPersistenceError,type NutritionRpcClient} from '../lib/nutrition-persistence';
import {migrationBundle} from '../scripts/migration-bundle';
import {id,foundationFixture} from './foundation-fixture';
import {nutritionAccess,deny} from './nutrition-db-fixture';
import {waterCommand,waterFixture,waterRpc,waterSql,type WaterFixture} from './native-water-fixture';
import {businessToday} from '../lib/care';
const org=id(10),client=id(100),context={organizationId:org,clientId:client};
const adapter=(f:WaterFixture)=>createNutritionWaterPersistence(waterRpc(f),context,businessToday);
const kind=(value:string)=>(error:unknown)=>error instanceof NutritionPersistenceError&&error.kind===value;
const rawSave=async(f:WaterFixture,value:unknown)=>(await f.db.query<{x:unknown}>('select aura_nutrition_water_save($1,$2,$3::jsonb) x',[org,client,JSON.stringify(value)])).rows[0].x;

test('prepared water SQL leaves existing functions permissions and policies unchanged and grants no anonymous surface',async()=>{
 const f=await foundationFixture();try{
  const functions=await f.db.query<{oid:number;definition:string;acl:string}>("select p.oid::integer oid,pg_get_functiondef(p.oid) definition,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') order by p.oid");
  const policies=await f.db.query<{oid:number;definition:string}>("select oid::integer oid,pg_get_expr(polqual,polrelid) definition from pg_policy order by oid");
  await f.db.exec('begin;'+await readFile(waterSql,'utf8')+'commit;');
  const after=await f.db.query("select p.oid::integer oid,pg_get_functiondef(p.oid) definition,p.proacl::text acl from pg_proc p where p.oid=any($1::oid[]) order by p.oid",[functions.rows.map(r=>r.oid)]);
  assert.deepEqual(after.rows,functions.rows);
  assert.deepEqual((await f.db.query("select oid::integer oid,pg_get_expr(polqual,polrelid) definition from pg_policy where oid=any($1::oid[]) order by oid",[policies.rows.map(r=>r.oid)])).rows,policies.rows);
  const api=(await f.db.query<{proname:string;anon:boolean;staff:boolean}>("select proname,has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') staff from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and (proname like 'nutrition_water_%' or proname like 'aura_nutrition_water_%')")).rows;
  assert.equal(api.length,10);assert.equal(api.some(row=>row.anon),false);assert.equal(api.filter(row=>!row.staff).length,2);
  const tables=(await f.db.query<{relrowsecurity:boolean;write:boolean}>("select relrowsecurity,has_table_privilege('authenticated',c.oid,'insert,update,delete') write from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private') and c.relkind='r' and c.relname like 'nutrition_water%'")).rows;
  assert.equal(tables.length,4);assert.ok(tables.every(row=>row.relrowsecurity&&!row.write));
 }finally{await f.db.close();}
});

test('water parser and SQL reject identity forgery, unsupported units, quantities, times, future dates and invalid reasons',async()=>{
 const f=await waterFixture();try{
  const good=waterCommand(),invalid=[null,{}, {...good,actor:id(2)},{...good,clientId:client},{...good,contractVersion:2},{...good,operation:null},{...good,waterId:id(3300)},{...good,expectedRevision:1},{...good,expectedRevision:0.5},{...good,reason:'new'},
   ...[0,5001,1.5,'250',null].map(amount=>({...good,entry:{...good.entry!,quantity:{amount,unit:'ml'}}})),
   ...['g','l','cups'].map(unit=>({...good,entry:{...good.entry!,quantity:{amount:250,unit}}})),
   ...['24:00','9:00','09:00:00','09:00Z'].map(time=>({...good,entry:{...good.entry!,time}})),
   ...['2026-02-30','0000-01-01','9999-12-31'].map(consumedOn=>({...good,entry:{...good.entry!,consumedOn}})),
   {...good,entry:{...good.entry!,extra:true}}];
  for(const value of invalid){assert.throws(()=>parseWaterCommandV1(value,businessToday()));await deny(rawSave(f,value),'22023');}
  assert.deepEqual(parseWaterCommandV1({...good,requestId:good.requestId.toUpperCase(),entry:{...good.entry!,time:null}},businessToday()).entry?.time,null);
  assert.equal((await adapter(f).diary(businessToday())).summary.declaredMl,null);
 }finally{await f.db.close();}
});
test('water save correct void and original replay preserve history authorship and full-day totals',async()=>{
 const f=await waterFixture();try{
  const dayBefore=new Date(businessToday()+'T12:00:00Z');dayBefore.setUTCDate(dayBefore.getUTCDate()-1);const yesterday=dayBefore.toISOString().slice(0,10);
  const a=adapter(f),original=waterCommand(),first=await a.save(original);assert.equal(first.revision,1);
  assert.deepEqual(await a.requestStatus(original.requestId),{waterId:first.waterId,revision:1});
  assert.equal((await a.diary(businessToday())).summary.declaredMl,250);
  const edit={...waterCommand(3001),waterId:first.waterId,expectedRevision:1,entry:{...original.entry!,consumedOn:yesterday,time:null,quantity:{amount:400,unit:'ml' as const}},reason:' Quantidade corrigida '};
  await a.save(edit);const h=await a.history(first.waterId);assert.equal(h.versions[0].entry.time,null);assert.equal(h.versions[0].reason,'Quantidade corrigida');assert.equal(h.versions[0].recordedBy,id(2));assert.equal(h.versions[1].entry.quantity.amount,250);
  assert.deepEqual(await a.save(original),{...first,replayed:true});assert.equal((await a.diary(yesterday)).summary.declaredMl,400);assert.deepEqual((await a.diary(businessToday())).summary,{activeCount:0,voidedCount:0,declaredMl:null});
  await assert.rejects(a.save({...edit,requestId:id(3002)}),kind('conflict'));
  await a.save({...waterCommand(3003),waterId:first.waterId,expectedRevision:2,operation:'void',entry:null,reason:'Duplicado declarado'});
  const day=await a.diary(yesterday);assert.deepEqual(day.summary,{activeCount:0,voidedCount:1,declaredMl:null});assert.equal(day.entries[0].status,'voided');assert.equal(day.entries[0].entry.quantity.amount,400);assert.equal((await a.history(first.waterId)).versions.length,3);
  await assert.rejects(a.save({...edit,requestId:id(3004),expectedRevision:3}),kind('conflict'));
  await f.db.exec('reset role');assert.equal((await f.db.query('select * from app_private.nutrition_water_events')).rows.length,3);
  await deny(f.db.query('update nutrition_water_versions set milliliters=1'),'55000');
  await deny(f.db.query('delete from nutrition_water'),'55000');
  assert.equal((await f.db.query('select * from nutrition_meals')).rows.length,0);
 }finally{await f.db.close();}
});
test('water access is staff-scoped and revocation, MFA and archive stay authoritative for every RPC',async()=>{
 const f=await waterFixture();try{
  const a=adapter(f),value=waterCommand(),saved=await a.save(value);
  for(const user of [1,3,4,5,7]){await f.asUser(user);await assert.rejects(a.diary(businessToday()),kind('denied'));await assert.rejects(a.history(saved.waterId),kind('denied'));await assert.rejects(a.requestStatus(value.requestId),kind('denied'));await assert.rejects(a.save(waterCommand(3010)),kind('denied'));assert.equal((await f.db.query('select * from nutrition_water')).rows.length,0);}
  await nutritionAccess(f,false);await assert.rejects(a.save(waterCommand(3010)),kind('denied'));assert.equal((await a.diary(businessToday())).entries.length,1);await assert.rejects(a.requestStatus(value.requestId),kind('denied'));
  await nutritionAccess(f);const other=createNutritionWaterPersistence(waterRpc(f),{organizationId:id(20),clientId:id(200)},businessToday);await assert.rejects(other.save(waterCommand(3011)),kind('denied'));
  await f.asUser(1);await f.db.query('select aura_assignment_save($1,$2,$3,false)',[org,client,id(2)]);await f.asUser(2);await assert.rejects(a.diary(businessToday()),kind('denied'));
  await nutritionAccess(f);await f.db.exec("reset role;insert into app_private.organization_security(organization_id,require_sensitive_aal2,revision,updated_by) values('"+org+"',true,1,'"+id(1)+"')");await f.asUser(2);await assert.rejects(a.diary(businessToday()),kind('denied'));await assert.rejects(a.save(waterCommand(3012)),kind('denied'));
  await f.db.exec("reset role;update app_private.organization_security set require_sensitive_aal2=false;update clients set archived_at=now() where id='"+client+"'");await f.asUser(2);await assert.rejects(a.save(waterCommand(3013)),kind('conflict'));assert.equal((await a.history(saved.waterId)).versions.length,1);
  await f.db.exec("reset role;set role anon;select set_config('request.jwt.claim.sub','',false)");await deny(f.db.query('select aura_nutrition_water_diary($1,$2,current_date,null)',[org,client]));
 }finally{await f.db.close();}
});
test('water diary totals cover all pages and revision cursors cannot silently truncate history',async()=>{
 const f=await waterFixture();try{
  const a=adapter(f),saved=[];for(let n=0;n<22;n++)saved.push(await a.save(waterCommand(3100+n)));
  const first=await a.diary(businessToday());assert.equal(first.entries.length,20);assert.equal(first.summary.declaredMl,5500);assert.equal(first.summary.activeCount,22);assert.ok(first.nextCursor);
  const last=await a.diary(businessToday(),first.nextCursor);assert.equal(last.entries.length,2);assert.deepEqual(last.summary,first.summary);assert.equal(new Set([...first.entries,...last.entries].map(e=>e.waterId)).size,22);
  for(let revision=1;revision<23;revision++)await a.save({...waterCommand(3200+revision),waterId:saved[0].waterId,expectedRevision:revision,reason:'Ajuste fictício'});
  const h=await a.history(saved[0].waterId);assert.equal(h.versions.length,20);assert.equal(h.nextCursor,4);const tail=await a.history(saved[0].waterId,h.nextCursor);assert.deepEqual(tail.versions.map(v=>v.revision),[3,2,1]);assert.equal(tail.nextCursor,null);
 }finally{await f.db.close();}
});
test('late failure rolls water state receipts and audit back; requests are canonical and scoped',async()=>{
 const f=await waterFixture();try{
  await f.db.exec("reset role;create function app_private.synthetic_water_failure() returns trigger language plpgsql as $$begin if new.request_id='"+id(3400)+"' then raise exception using errcode='23514',message='Synthetic failure';end if;return new;end;$$;create trigger synthetic_water_failure before insert on app_private.nutrition_water_events for each row execute function app_private.synthetic_water_failure();");await f.asUser(2);
  await deny(rawSave(f,waterCommand(3400)),'23514');await f.db.exec('reset role');for(const table of ['nutrition_water','nutrition_water_versions','app_private.nutrition_water_requests','app_private.nutrition_water_events'])assert.equal((await f.db.query('select * from '+table)).rows.length,0);
  await f.asUser(2);const a=adapter(f),value=waterCommand(3401),saved=await a.save(value);assert.equal((await rawSave(f,{...value,entry:{quantity:{unit:'ml',amount:250.000},time:'09:00',consumedOn:businessToday()}}) as {replayed:boolean}).replayed,true);
  await assert.rejects(a.save({...value,entry:{...value.entry!,quantity:{amount:251,unit:'ml'}}}),kind('conflict'));
  await f.grant(2,101,['profile']);await f.asUser(2);const other=createNutritionWaterPersistence(waterRpc(f),{organizationId:org,clientId:id(101)},businessToday);await assert.rejects(other.save(value),kind('conflict'));assert.equal(await other.requestStatus(value.requestId),null);assert.equal((await a.history(saved.waterId)).versions.length,1);
 }finally{await f.db.close();}
});
test('inactive adapter fails closed on obsolete context uncertain writes missing RPC and malformed projections',async()=>{
 let calls=0,release!:(v:{data:unknown;error:null})=>void;
 const delayed:NutritionRpcClient={rpc(){calls++;return {abortSignal:()=>new Promise(r=>{release=r;})};}};
 const a=createNutritionWaterPersistence(delayed,context,businessToday),pending=a.diary(businessToday());a.dispose();release({data:null,error:null});await assert.rejects(pending,kind('stale'));await assert.rejects(a.save(waterCommand()),kind('stale'));assert.equal(calls,1);
 const lost:NutritionRpcClient={rpc(){calls++;return {abortSignal:async()=>{throw Error('lost ack');}};}};
 const b=createNutritionWaterPersistence(lost,context,businessToday);await assert.rejects(b.save(waterCommand()),kind('uncertain'));assert.equal(calls,2);
 const fixed=(data:unknown,error:{code:string}|null=null):NutritionRpcClient=>({rpc(){return {abortSignal:async()=>({data,error})};}});
 await assert.rejects(createNutritionWaterPersistence(fixed(null,{code:'PGRST202'}),context,businessToday).save(waterCommand()),kind('unavailable'));
 await assert.rejects(createNutritionWaterPersistence(fixed({}),context,businessToday).save(waterCommand()),kind('uncertain'));
 await assert.rejects(createNutritionWaterPersistence(fixed({entries:[],nextCursor:null,summary:{activeCount:0,voidedCount:0,declaredMl:0}}),context,businessToday).diary(businessToday()),kind('invalid-response'));
 const row={waterId:id(3500),revision:1,entry:waterCommand().entry,status:'recorded',reason:null,recordedBy:id(2)};
 await assert.rejects(createNutritionWaterPersistence(fixed({entries:[row],nextCursor:null,summary:{activeCount:1,voidedCount:0,declaredMl:400}}),context,businessToday).diary(businessToday()),kind('invalid-response'));
 const edited={...row,revision:3,reason:'Ajuste declarado'};
 await assert.rejects(createNutritionWaterPersistence(fixed({versions:[edited,row],nextCursor:null}),context,businessToday).history(row.waterId),kind('invalid-response'));
 await assert.rejects(createNutritionWaterPersistence(fixed({versions:[{...row,revision:2,reason:'Ajuste declarado'},row],nextCursor:null}),context,businessToday).history(row.waterId,4),kind('invalid-response'));
 await assert.rejects(createNutritionWaterPersistence(fixed({versions:[],nextCursor:null}),context,businessToday).history(row.waterId,21),kind('invalid-response'));
 assert.deepEqual(await createNutritionWaterPersistence(fixed({versions:[],nextCursor:null}),context,businessToday).history(row.waterId,1),{versions:[],nextCursor:null});
 const installer=await migrationBundle();assert.ok(!installer.includes('create table public.nutrition_water ('));assert.equal((await readFile(waterSql,'utf8')).includes('create or replace'),false);
});
