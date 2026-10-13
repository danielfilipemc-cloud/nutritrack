"use client";
import { useProfessional } from "../../lib/use-professional";
import ProfessionalShell from "../../components/ProfessionalShell";
import OrganizationSelect from "../../components/OrganizationSelect";
import TenantBrand from "../../components/TenantBrand";
import AgendaPanel from "../../components/AgendaPanel";
export default function Agenda() {
  const { user, org, orgs, setOrg, status } = useProfessional(),
    current = orgs.find((o) => o.id === org);
  return (
    <ProfessionalShell title="Agenda do estabelecimento">
      <div className="heading">
        <div>
          <span className="eyebrow">ORGANIZAÇÃO DIÁRIA</span>
          <h1>Agenda</h1>
          <p>Sessões, avaliações e revisões num só lugar.</p>
        </div>
        <OrganizationSelect
          organizations={orgs}
          value={org}
          onChange={setOrg}
        />
      </div>
      {!user && (
        <a href="/" className="outline link">
          Iniciar sessão
        </a>
      )}
      {user && org ? (
        <>
          <TenantBrand
            key={`brand:${user.id}:${org}`}
            org={org}
            name={current?.name || "AURA"}
            subtitle="Agenda da equipa"
          />
          <AgendaPanel
            key={`agenda:${user.id}:${org}`}
            org={org}
            userId={user.id}
            role={current?.role || "coach"}
          />
        </>
      ) : (
        <p role="status">{status}</p>
      )}
    </ProfessionalShell>
  );
}
