'use client';
import {useState} from 'react';
import Link from 'next/link';
import {previewNativeMigration, type MigrationManifest, type MigrationCategory, type Json} from '../../../lib/native-migration';
import {migrationFixture} from '../../../lib/native-migration-fixture';
import './migration.css';
const labels: Record<MigrationCategory,string> = {meals:'Diário alimentar',water:'Hidratação',foods:'Alimentos próprios',measurements:'Peso e medidas',templates:'Modelos do dia',profile:'Perfil e metas',preferences:'Preferências e hábitos',photos:'Fotografias',unknown:'Campos por mapear'};
type Receipt = {snapshot:string;total:number;prepared:number;pending:number};
export default function MigrationRehearsal() {
 const [variant,setVariant]=useState('original');const [target,setTarget]=useState('aluno-exemplo-a');
 const [manifest,setManifest]=useState<MigrationManifest|null>(null);const [receipts,setReceipts]=useState<Record<string,Receipt>>({});
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 async function prepare() {
  setBusy(true);setMessage('');
  try {
   const fixture=structuredClone(migrationFixture);
   if(variant==='reordered'){fixture.data.nutritrackData.meals.reverse();fixture.exportedAt='2026-10-27T11:00:00Z';}
   if(variant==='changed')fixture.data.waterData['2026-10-25']=4;
   setManifest(await previewNativeMigration(JSON.stringify(fixture),'origem-exemplo-a','2026-10-27'));
   setMessage('Inventário pronto. Ainda não foi registado neste ensaio.');
  } catch(e) {setManifest(null);setMessage(e instanceof Error?e.message:'Não foi possível preparar o inventário.');}
  finally{setBusy(false);}
 }
 function receive() {
  if(!manifest)return;
  const previous=receipts[target];
  if(previous && previous.snapshot!==manifest.snapshot){setMessage('Conflito: esta origem já tem um snapshot diferente para este aluno. Nenhum registo foi substituído.');return;}
  if(previous){setMessage('Repetição reconhecida: 0 registos novos. O recibo anterior foi preservado.');return;}
  setReceipts({...receipts,[target]:{snapshot:manifest.snapshot,...manifest.counts}});
  setMessage(`Ensaio registado: ${manifest.counts.total} registos inventariados, incluindo ${manifest.counts.pending} pendências preservadas. Nada foi enviado para uma conta.`);
 }
 const receipt=receipts[target];
 return <main id="main-content" className="aura-migration" tabIndex={-1}>
  <header><Link href="/demo/experiencia">← Experiência Premium</Link><span className="migration-tag">AURA · Laboratório de migração</span>
   <h1>O histórico acompanha o aluno.</h1><p>Ensaia a passagem do NutriTrack para o AURA com origem, contagens e pendências visíveis.</p>
  </header>
  <aside className="migration-notice"><strong>Apenas dados fictícios</strong><p>Este laboratório não lê ficheiros, contas ou dados pessoais. Os recibos existem apenas nesta página; recarregar repõe o ensaio. Não é uma migração concluída nem persistência profissional.</p></aside>
  <section className="migration-card" aria-labelledby="prepare-title"><span className="migration-step">01 · Preparação</span><h2 id="prepare-title">Escolher o cenário</h2>
   <div className="migration-controls"><label>Backup de exemplo<select disabled={busy} value={variant} onChange={e=>{setVariant(e.target.value);setManifest(null);setMessage('');}}>
    <option value="original">Original · duas refeições iguais legítimas</option><option value="reordered">Nova exportação · mesmos dados</option><option value="changed">Exportação alterada · mais água</option>
   </select></label><label>Destino fictício<select disabled={busy} value={target} onChange={e=>{setTarget(e.target.value);setMessage('');}}><option value="aluno-exemplo-a">Aluno de exemplo A</option><option value="aluno-exemplo-b">Aluno de exemplo B</option></select></label></div>
   <button disabled={busy} onClick={prepare}>{busy?'A preparar…':'Preparar inventário'}</button>
  </section>
  <p className="migration-status" role="status" aria-live="polite">{message}</p>
  {manifest&&<>
   <section className="migration-card" aria-labelledby="inventory-title"><span className="migration-step">02 · Inventário</span><h2 id="inventory-title">Tudo contado. Nada descartado em silêncio.</h2>
    <div className="migration-metrics"><div><strong>{manifest.counts.total}</strong><span>Registos de origem</span></div><div><strong>{manifest.counts.prepared}</strong><span>Mapeamento preparado</span></div><div><strong>{manifest.counts.pending}</strong><span>Pendências preservadas</span></div></div>
    <p>Preparado significa contrato offline validado. As pendências continuam no inventário e exigem uma decisão antes da transição real.</p>
    <div className="migration-categories">{(Object.keys(labels) as MigrationCategory[]).map(category=>{
     const records=manifest.records.filter(r=>r.category===category);if(!records.length)return null;const pending=records.filter(r=>r.disposition==='pending').length;
     return <details key={category}><summary>{labels[category]} <span>{records.length} {records.length===1?'registo':'registos'} · {pending} {pending===1?'pendente':'pendentes'}</span></summary>
      {records.map(r=><article key={r.id}><strong>{r.disposition==='prepared'?'Mapeamento preparado':'Decisão pendente'}</strong><p>{r.reason}</p>
       <p className="migration-origin">Origem: {r.origin} · {r.id.slice(-8)}</p>
       <details><summary>Ver valores de origem e destino</summary><pre>{JSON.stringify({origem:r.raw,destino:r.normalized} as Json,null,2)}</pre></details>
      </article>)}
     </details>;
    })}</div>
   </section>
   <section className="migration-card" aria-labelledby="receipt-title"><span className="migration-step">03 · Reconciliação</span><h2 id="receipt-title">Ensaiar sem duplicar</h2>
    <p>A mesma exportação repete o recibo. Uma exportação com alterações fica bloqueada para revisão. Duas refeições iguais mantêm dois registos.</p>
    <button onClick={receive}>Ensaiar receção neste aluno</button>
    {receipt&&<div className="migration-receipt"><strong>Recibo do {target==='aluno-exemplo-a'?'aluno A':'aluno B'}</strong><p>{receipt.total} registos · {receipt.prepared} preparados · {receipt.pending} pendentes</p><code>{receipt.snapshot}</code></div>}
   </section>
  </>}
  <footer>Para concluir: persistência autenticada, destino das pendências, ensaio integral e reconciliação aprovada antes de retirar a aplicação antiga.</footer>
 </main>;
}
