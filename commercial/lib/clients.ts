export const CLIENT_PAGE_SIZE=25;
/** Escape SQL LIKE wildcards; search is a literal substring, never a filter expression. */
export function literalSearch(value:string){return value.trim().slice(0,160).replace(/[\\%_]/g,"\\$&");}
export type ClientRecord={id:string;full_name:string;created_at:string;updated_at:string;archived_at:string|null;revision:number};
