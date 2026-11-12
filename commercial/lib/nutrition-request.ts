/** A deadline aborts the client request, never confirms cancellation on the server.
 * Each operation owns its timer; timing out does not dispose the scoped adapter. */
export const nutritionRequestTimeoutMs=8000;
export async function nutritionRequest<T>(scope:AbortSignal,operation:(signal:AbortSignal)=>PromiseLike<T>):Promise<T>{
 if(scope.aborted)throw new Error('Nutrition request scope disposed');
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,abort:()=>void=()=>{};
 const interrupted=new Promise<never>((_,reject)=>{
  abort=()=>{controller.abort();reject(new Error('Nutrition request scope disposed'));};
  scope.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>{controller.abort();reject(new Error('Nutrition request deadline exceeded'));},nutritionRequestTimeoutMs);
 });
 try{return await Promise.race([operation(controller.signal),interrupted]);}
 finally{clearTimeout(timer);scope.removeEventListener('abort',abort);}
}
