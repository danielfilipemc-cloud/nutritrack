'use client';
import ProfessionalShell from '../../components/ProfessionalShell';
import OrganizationSelect from '../../components/OrganizationSelect';
import SecurityWorkspace from '../../components/SecurityWorkspace';
import {useProfessional} from '../../lib/use-professional';
export default function Security(){const {user,org,orgs,setOrg,authLoading,status}=useProfessional();return <ProfessionalShell title="Segurança da conta" context={<OrganizationSelect organizations={orgs} value={org} onChange={setOrg}/>}><h1>Segurança da conta</h1>{authLoading?<p role="status">A verificar sessão...</p>:!user?<p>{status} <a href="/">Iniciar sessão</a></p>:<><SecurityWorkspace key={`${user.id}:${org}`} org={org}/></>}</ProfessionalShell>;}
