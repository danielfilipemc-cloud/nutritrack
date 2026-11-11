"use client";
import {useEffect, useRef, useState} from 'react';
import {demoDays, demoFoods} from '../lib/nutrition-demo';
import {parseNutritionCommandV1, type NutritionCommandV1} from '../lib/nutrition-command';
import {nutritionTotals} from '../lib/nutrition-contract';

/** Workflow rehearsal only. Never imports a client, storage or API adapter. */
export default function NutritionEntryDemo({onDirtyChange}: {onDirtyChange: (dirty: boolean) => void}) {
 const [food,setFood] = useState('cereal'), [grams,setGrams] = useState('100'), [date,setDate] = useState<string>(demoDays[0]);
 const [kind,setKind] = useState<NutritionCommandV1['mealKind']>('breakfast');
 const [stage,setStage] = useState<'editing'|'review'|'conflict'|'uncertain'|'done'>('editing');
 const [outcome,setOutcome] = useState('success'), [error,setError] = useState('');
 const [command,setCommand] = useState<NutritionCommandV1|null>(null);
 const [versions,setVersions] = useState<NutritionCommandV1[]>([]);
 const report = useRef(onDirtyChange); report.current = onDirtyChange;
 const dirty = stage === 'review' || stage === 'conflict' || stage === 'uncertain' || (stage === 'editing' && (grams !== '100' || food !== 'cereal' || date !== demoDays[0] || kind !== 'breakfast'));
 useEffect(() => {report.current(dirty);}, [dirty]);
 useEffect(() => () => report.current(false), []);
 const latest = versions.at(-1), voided = latest?.operation === 'void';
 function review(operation: 'save'|'void') {
  try {
   const selected = demoFoods.find(item => item.id === food)!;
   const next = parseNutritionCommandV1({contractVersion: 1, requestId: crypto.randomUUID(), mealId: latest?.mealId ?? null, expectedRevision: versions.length, consumedOn: operation === 'void' ? latest?.consumedOn : date, mealKind: operation === 'void' ? latest?.mealKind : kind, operation, items: operation === 'void' ? [] : [{label: selected.name, source: 'manual', composition: selected.composition, quantity: {amount: grams.trim() ? Number(grams) : NaN, unit: 'g'}}]}, demoDays[0]);
   setCommand(next); setError(''); setStage('review');
  } catch {setError('Indica uma data de exemplo válida e uma quantidade entre 0,001 e 5000 g, com até três casas decimais.');}
 }
 function confirm() {
  if (stage !== 'review' || !command) return;
  if (outcome === 'conflict') {setStage('conflict'); return;}
  const saved = structuredClone(command); saved.mealId ??= crypto.randomUUID();
  setVersions(previous => [...previous,saved]);
  setStage(outcome === 'uncertain' ? 'uncertain' : 'done');
 }
 const totals = command && command.operation === 'save' ? nutritionTotals(command.items.map(({composition,quantity}) => ({composition,quantity}))) : null;
 return <section className="panel" aria-label="Ensaio de registo nutricional">
  <h3>Ensaiar um registo</h3><p>Exercício fictício em memória, separado do diário de exemplo e do aluno. Ao sair desta área, os exemplos desaparecem. Não há ligação à base de dados.</p>
  {stage === 'editing' && !voided && <form onSubmit={event => {event.preventDefault(); review('save');}}>
   <div className="aura-nutrition-toolbar"><label>Data do registo fictício<select value={date} onChange={event => setDate(event.target.value)}>{demoDays.map(day => <option key={day}>{day}</option>)}</select></label>
   <label>Refeição de exemplo<select value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="breakfast">Pequeno-almoço</option><option value="lunch">Almoço</option><option value="dinner">Jantar</option><option value="snack">Lanche</option><option value="other">Outra</option></select></label></div>
   <label>Alimento fictício<select value={food} onChange={event => setFood(event.target.value)}>{demoFoods.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
   <label>Quantidade do registo fictício (g)<input type="number" min="0.001" max="5000" step="0.001" value={grams} onChange={event => setGrams(event.target.value)} required/></label>
   <button>Rever exemplo</button>
  </form>}
  {error && <p role="alert">{error}</p>}
  {stage === 'review' && command && <section aria-label="Revisão do exemplo"><h4>{command.operation === 'void' ? 'Confirmar anulação fictícia' : 'Rever antes de confirmar'}</h4><p>{command.consumedOn} · Revisão esperada: {command.expectedRevision}</p>
   {command.items.map(item => <p key={item.label}>{item.label} · {item.quantity.amount} g</p>)}
   {totals && <p>Energia: {totals.nutrients.calories === null ? 'desconhecida' : `${totals.nutrients.calories} kcal`} · Sem avaliação de adequação.</p>}
   <label>Cenário do ensaio<select value={outcome} onChange={event => setOutcome(event.target.value)}><option value="success">Confirmação local</option><option value="conflict">Conflito simulado</option><option value="uncertain">Resposta perdida simulada</option></select></label>
   <div className="aura-nutrition-toolbar"><button onClick={confirm}>Confirmar apenas no ensaio</button><button className="outline" onClick={() => {setStage('editing'); setCommand(null);}}>Voltar ao rascunho</button></div>
  </section>}
  {stage === 'conflict' && <div role="alert"><p>Conflito simulado. O rascunho mantém-se; nenhuma revisão foi substituída. Numa ligação real seria necessário consultar e comparar a versão atual antes de tentar novamente.</p><button className="outline" onClick={() => {setStage('editing'); setCommand(null);}}>Rever rascunho preservado</button></div>}
  {stage === 'uncertain' && <div role="alert"><p>Resposta perdida simulada. Não repetir a gravação: o recibo local já existe e será consultado com a mesma identidade de pedido.</p><button className="outline" onClick={() => setStage('done')}>Verificar resultado simulado</button></div>}
  {stage === 'done' && <div role="status"><p>{voided ? 'Anulação fictícia confirmada; o histórico foi preservado.' : 'Exemplo confirmado apenas em memória.'}</p>{!voided && <div className="aura-nutrition-toolbar"><button className="outline" onClick={() => {setStage('editing'); setCommand(null);}}>Corrigir exemplo</button><button className="outline" onClick={() => review('void')}>Rever anulação fictícia</button></div>}</div>}
  {!!versions.length && <section aria-label="Histórico do ensaio"><h4>Histórico apenas deste ensaio</h4><ol>{versions.map((value,index) => <li key={value.requestId}>Revisão {index + 1} · {value.operation === 'void' ? 'Anulada — composição anterior preservada' : `${value.items[0].label}: ${value.items[0].quantity.amount} g`} · {value.consumedOn}</li>)}</ol></section>}
 </section>;
}
