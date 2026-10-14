import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

const protectedProjects=new Set(['vfplbkfxipfictuwkkoe','maipjryehnllaifxhunf']);
export type StagingApproval={project_ref:string;synthetic_only:true;restore:{verified:true;archive_sha256:string;evidence_file:string;evidence_sha256:string}};
export function assertStagingTarget(url:string,approval:StagingApproval){
 const target=new URL(url);
 if(target.protocol!=='https:'||target.username||target.password||target.port||target.pathname!=='/'||target.search||target.hash)throw new Error('Invalid staging URL');
 if(!/^[a-z]{20}$/.test(approval.project_ref)||protectedProjects.has(approval.project_ref)||target.hostname!==`${approval.project_ref}.supabase.co`)throw new Error('Protected or unapproved project: staging operation refused');
 if(approval.synthetic_only!==true||approval.restore?.verified!==true||![approval.restore.archive_sha256,approval.restore.evidence_sha256].every(h=>/^[a-f0-9]{64}$/.test(h))||!approval.restore.evidence_file)throw new Error('Verified synthetic staging restore evidence required');
}
export async function loadStagingApproval(url:string){
 const file=process.env.AURA_STAGING_APPROVAL_FILE;
 if(!file)throw new Error('Set AURA_STAGING_APPROVAL_FILE explicitly; no production env fallback');
 const approval=JSON.parse(await readFile(file,'utf8')) as StagingApproval;
 assertStagingTarget(url,approval);
 const evidence=await readFile(approval.restore.evidence_file);
 if(createHash('sha256').update(evidence).digest('hex')!==approval.restore.evidence_sha256)throw new Error('Restore evidence integrity mismatch');
 return approval;
}
export function refuseLegacyLiveRunner():never{
 throw new Error('Legacy live runner disabled: it targets the protected AURA project and assumes baseline permissions. Use test:foundations:staging after approved isolated staging and verified restore.');
}
