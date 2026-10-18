"use client";
import {useEffect, useRef, useState} from 'react';
import {demoDays, demoFoods, demoMeals} from '../lib/nutrition-demo';
import {nutrientKeys, nutritionTotals, type PortionV1} from '../lib/nutrition-contract';

const labels = {calories: 'Energia', protein: 'Proteína', carbs: 'Hidratos', fat: 'Gordura'};
const format = (value: number) => new Intl.NumberFormat('pt-PT', {maximumFractionDigits: 2}).format(value);
function Composition({portions}: {portions: readonly PortionV1[]}) {
 const total = nutritionTotals(portions);
 return <div className="aura-nutrition-metrics">{nutrientKeys.map(key => <article key={key} className="aura-nutrition-metric"><span>{labels[key]}</span><strong>{total.nutrients[key] === null ? '—' : format(total.nutrients[key])}<small> {key === 'calories' ? 'kcal' : 'g'}</small></strong><p>{!total.count ? 'Sem registos' : total.missing[key] ? `${format(total.knownSubtotal[key])} conhecidos · ${total.missing[key]} item sem valor` : 'Composição conhecida'}</p></article>)}</div>;
}
export default function NutritionDemo({onDirtyChange}: {onDirtyChange: (dirty: boolean) => void}) {
 const [tab, setTab] = useState<'summary'|'diary'|'foods'>('summary');
 const [day, setDay] = useState<string>(demoDays[0]), [meal, setMeal] = useState('breakfast');
 const [food, setFood] = useState('cereal'), [query, setQuery] = useState(''), [grams, setGrams] = useState('100');
 const report = useRef(onDirtyChange); report.current = onDirtyChange;
 useEffect(() => () => report.current(false), []);
 const dirty = grams !== '100';
 function reset() {setGrams('100'); report.current(false);}
 function leave() {if (dirty && !window.confirm('Descartar a simulação de porção antes de continuar?')) return false; reset(); return true;}
 const meals = demoMeals(day), selectedMeal = meals.find(item => item.id === meal) ?? meals[0];
 const selectedFood = demoFoods.find(item => item.id === food)!;
 let simulation: PortionV1[] | null = null;
 try {const portion: PortionV1 = {composition: selectedFood.composition, quantity: {amount: grams.trim() ? Number(grams) : NaN, unit: 'g'}}; nutritionTotals([portion]); simulation = [portion];} catch { /* Invalid input must not retain previous computed values. */ }
 return <section className="aura-nutrition" aria-label="Nutrição de demonstração">
  <header className="panel aura-nutrition-header"><div><span className="eyebrow">NUTRIÇÃO · DEMONSTRAÇÃO</span><h2>Um diário mais claro</h2><p>Resumo, refeições e composição num só lugar.</p></div><span className="aura-badge">Sem persistência</span><p className="aura-nutrition-notice">Dados inventados. Este diário não pertence ao aluno desta ficha. A demonstração não guarda alterações nem fornece recomendações alimentares.</p></header>
  <nav aria-label="Áreas de nutrição" className="aura-nutrition-tabs">{([['summary', 'Resumo alimentar'], ['diary', 'Diário'], ['foods', 'Composição']] as const).map(([value, label]) => <button key={value} className="outline" aria-pressed={tab === value} onClick={() => {if (value !== tab && leave()) setTab(value);}}>{label}</button>)}</nav>
  {tab !== 'foods' && <div className="aura-nutrition-toolbar"><label>Dia de exemplo<select value={day} onChange={event => {if (leave()) {setDay(event.target.value); setMeal('breakfast');}}}>{demoDays.map(date => <option key={date}>{date}</option>)}</select></label><p>Registo diário incompleto · sem metas de consumo</p></div>}
  {tab === 'summary' && <><Composition portions={meals.flatMap(item => item.items.map(entry => entry.portion))}/><section className="panel"><div className="aura-section-title"><h3>Refeições registadas</h3><span>{meals.length} refeições</span></div>{!meals.length ? <p className="aura-empty-state">Sem registos neste dia. Não é possível concluir que o consumo foi zero.</p> : meals.map(item => <button key={item.id} className="outline aura-nutrition-meal" onClick={() => {setMeal(item.id); setTab('diary');}}><span><strong>{item.name}</strong><small>{item.items.length} alimentos de exemplo</small></span><span>{item.time} →</span></button>)}</section></>}
  {tab === 'diary' && <div className="aura-nutrition-layout"><section className="panel"><h3>Diário alimentar</h3>{meals.length ? meals.map(item => <button className="outline aura-nutrition-meal" key={item.id} aria-pressed={selectedMeal?.id === item.id} onClick={() => setMeal(item.id)}>{item.name}<span>{item.time}</span></button>) : <p className="aura-empty-state">Sem registos neste dia.</p>}</section>{selectedMeal && <section className="panel"><h3>{selectedMeal.name}</h3><p>Composição dos alimentos registados, sem avaliação de adequação.</p><Composition portions={selectedMeal.items.map(item => item.portion)}/><div className="tablewrap" tabIndex={0} aria-label="Alimentos da refeição"><table><thead><tr><th>Alimento inventado</th><th>Quantidade</th></tr></thead><tbody>{selectedMeal.items.map((item, index) => <tr key={index}><td>{item.name}</td><td>{format(item.portion.quantity.amount)} g</td></tr>)}</tbody></table></div></section>}</div>}
  {tab === 'foods' && <div className="aura-nutrition-layout"><section className="panel"><h3>Alimentos de exemplo</h3><label>Pesquisar exemplos<input type="search" value={query} onChange={event => setQuery(event.target.value)}/></label>{demoFoods.filter(item => item.name.toLocaleLowerCase('pt').includes(query.toLocaleLowerCase('pt'))).map(item => <button key={item.id} className="outline aura-nutrition-meal" aria-pressed={food === item.id} onClick={() => {if (food !== item.id && leave()) setFood(item.id);}}>{item.name}</button>)}{!demoFoods.some(item => item.name.toLocaleLowerCase('pt').includes(query.toLocaleLowerCase('pt'))) && <p>Sem exemplos correspondentes.</p>}</section><section className="panel"><h3>{selectedFood.name}</h3><p>Composição inventada por 100 g · valores desconhecidos aparecem como —.</p><Composition portions={[{composition: selectedFood.composition, quantity: {amount: 100, unit: 'g'}}]}/><details><summary>Simular porção</summary><p>Simulação local; não altera o diário.</p><label>Quantidade de exemplo (g)<input type="number" min="0.001" max="5000" step="0.001" value={grams} onChange={event => {setGrams(event.target.value); report.current(event.target.value !== '100');}}/></label><button className="outline" onClick={reset}>Repor 100 g</button><div aria-live="polite">{simulation ? <Composition portions={simulation}/> : <p role="alert">Indica entre 0,001 e 5000 g, com até três casas decimais.</p>}</div></details></section></div>}
 </section>;
}
