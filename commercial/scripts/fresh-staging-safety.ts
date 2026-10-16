/** Narrow provisioning gate for the newly authorized EMPTY cloud sandbox.
 * This does not authorize migrations, restore, deletion, cleanup or production. */
export const freshStagingProject='vgbwmamntjmhzrpvhxzb';
export function assertFreshStagingTarget(url:string,confirmation:string|undefined){
 if(url!==`https://${freshStagingProject}.supabase.co`||confirmation!==freshStagingProject)
  throw new Error('Fresh synthetic provisioning requires the explicitly approved staging project');
 return {project_ref:freshStagingProject,synthetic_only:true as const};
}
export function assertFreshStagingEmpty(organizations:number|null,users:number){
 if(organizations!==0||users!==0)throw new Error('Fresh staging is not empty; refusing provisioning without a new reviewed validation plan');
}
