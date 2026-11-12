import type {DocumentVersion} from '../lib/nutrition-document-persistence';
import type {FrozenDish,PlanBody,RecipeBody} from '../lib/nutrition-document-command';
import type {NutritionItemV1} from '../lib/nutrition-command';
import {nutritionTotals} from '../lib/nutrition-contract';
function Foods({items}:{items:NutritionItemV1[]}){
 const totals=nutritionTotals(items.map(({composition,quantity})=>({composition,quantity}))).nutrients;
 return <><ul>{items.map((item,i)=><li key={i}>{item.label} · {item.quantity.amount} g</li>)}</ul><p>Composição declarada: {totals.calories??'—'} kcal · proteína {totals.protein??'—'} g · hidratos {totals.carbs??'—'} g · gordura {totals.fat??'—'} g. — significa desconhecido.</p></>;
}
function Dish({dish}:{dish:FrozenDish}){
 return dish.source==='manual'?<Foods items={dish.items}/>:<><p>{dish.snapshot.title} · receita versão {dish.revision} (composição congelada)</p><Foods items={dish.snapshot.items}/></>;
}
export default function NutritionDocumentPreview({version}:{version:DocumentVersion}){
 return <details><summary>Consultar conteúdo da versão {version.revision}</summary>{version.body.notes&&<p>{version.body.notes}</p>}{version.kind==='recipe'?<Foods items={(version.body as RecipeBody).items}/>:<>{(version.body as PlanBody<FrozenDish>).meals.map(meal=><section key={meal.id}><h4>{meal.label}{meal.time?` · ${meal.time}`:''}</h4><Dish dish={meal.primary}/>{meal.alternatives.map(a=><details key={a.id}><summary>Alternativa: {a.label}</summary><Dish dish={a.dish}/></details>)}</section>)}<p>Alternativas não são somadas ao prato principal. O documento não declara consumo.</p></>}</details>;
}
