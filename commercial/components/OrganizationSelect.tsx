import type {Organization} from "../lib/use-professional";
import SecurityRequirement from './SecurityRequirement';

export default function OrganizationSelect({organizations, value, onChange, disabled = false}: {
  organizations: Organization[]; value: string; onChange: (id: string) => void; disabled?: boolean;
}) {
  return <><label>Estabelecimento<select value={value} disabled={disabled || !organizations.length}
    onChange={e => onChange(e.target.value)}>
    {!organizations.length && <option value="">Sem estabelecimento disponível</option>}
    {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
  </select></label>{value&&<SecurityRequirement key={value} org={value}/>}</>;
}
