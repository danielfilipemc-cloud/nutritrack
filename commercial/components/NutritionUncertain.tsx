'use client';
export default function NutritionUncertain({requestId,busy,abandoned,onCheck,onAbandon}:{requestId:string;busy:boolean;abandoned:boolean;onCheck:()=>void;onAbandon:()=>void}){
 return <aside role="alert"><h4>Resultado por confirmar</h4><p>Não repitas a gravação. Uma falha de rede ou um recibo ausente não prova que o pedido foi recusado.</p><p>Referência do pedido: <code>{requestId}</code></p>
 <button disabled={busy} onClick={onCheck}>Consultar recibo</button>{!abandoned&&<button className="outline" disabled={busy} onClick={()=>{if(window.confirm('Sair não cancela a operação no servidor. Guarda a referência e revê o diário antes de voltar a registar. Queres permitir a saída sem repetir o pedido?'))onAbandon();}}>Permitir saída sem repetir</button>}
 {abandoned&&<p>Saída permitida por confirmação. O pedido não foi cancelado; a gravação continua bloqueada nesta vista.</p>}</aside>;
}
