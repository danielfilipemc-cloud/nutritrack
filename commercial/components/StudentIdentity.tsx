import type {ReactNode} from 'react';
/** An initial, not a profile photo or an additional student field. */
export default function StudentIdentity({name,children}: {name:string;children:ReactNode}) {
 const parts=name.trim().split(/\s+/).filter(Boolean);
 const initials=[parts[0],parts.length>1?parts.at(-1):undefined].filter(Boolean).map(word=>Array.from(word!)[0]).join('').toLocaleUpperCase('pt-PT');
 return <div className="aura-student-identity"><span className="aura-student-initial" aria-hidden="true">{initials}</span><div>{children}</div></div>;
}
