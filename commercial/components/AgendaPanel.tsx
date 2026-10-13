"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { db } from "../lib/supabase";
import { RequestScope } from "../lib/request-scope";
import {
  appointmentKinds,
  appointmentStatuses,
  appointmentInstant,
  localDateTime,
  formatAppointment,
  agendaRange,
  businessToday,
  addDays,
  careError,
  type Appointment,
  type Professional,
} from "../lib/care";
import ClientPicker, { type SelectedClient } from "./ClientPicker";
import { clientProfileUrl } from "../lib/dashboard";
export default function AgendaPanel({
  org,
  userId,
  role,
  client,
}: {
  org: string;
  userId: string;
  role: string;
  client?: SelectedClient;
}) {
  const reads = useRef(new RequestScope()),
    writes = useRef(new RequestScope());
  const [day, setDay] = useState(businessToday()),
    [days, setDays] = useState(7),
    [filter, setFilter] = useState("scheduled"),
    [professionalFilter, setProfessionalFilter] = useState(""),
    [page, setPage] = useState(0),
    [rows, setRows] = useState<Appointment[]>([]),
    [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [revision, setRevision] = useState(0),
    [professionals, setProfessionals] = useState<Professional[]>([]),
    [rosterReady, setRosterReady] = useState(false),
    [conflict, setConflict] = useState(false);
  const [selected, setSelected] = useState<SelectedClient | null>(
      client || null,
    ),
    [editing, setEditing] = useState<Appointment | null>(null),
    [start, setStart] = useState(businessToday() + "T09:00"),
    [duration, setDuration] = useState(60),
    [professional, setProfessional] = useState(userId),
    [kind, setKind] = useState<Appointment["kind"]>("session");
  const manager = role === "owner" || role === "admin";
  useEffect(() => {
    if (!db) return;
    let active = true;
    setRosterReady(false);
    void db
      .rpc("aura_professional_choices", { p_org: org })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setMessage("Não foi possível carregar os profissionais.");
          return;
        }
        setProfessionals(data || []);
        setRosterReady(true);
      });
    return () => {
      active = false;
      writes.current.invalidate();
    };
  }, [org, userId, revision]);
  useEffect(() => {
    if (!db) return;
    const valid = reads.current.begin();
    setRows([]);
    setTotal(0);
    setReady(false);
    setLoading(true);
    let range;
    try {
      range = agendaRange(day, days);
    } catch {
      setLoading(false);
      setMessage("Indica uma data válida para consultar a agenda.");
      return;
    }
    let q = db
      .from("appointments")
      .select(
        "id,organization_id,client_id,professional_id,kind,status,starts_at,ends_at,revision,clients!appointments_client_tenant_fk(full_name,archived_at)",
        { count: "exact" },
      )
      .eq("organization_id", org)
      .gte("starts_at", range.start)
      .lt("starts_at", range.end);
    if (client) q = q.eq("client_id", client.id);
    if (filter) q = q.eq("status", filter);
    if (professionalFilter) q = q.eq("professional_id", professionalFilter);
    void q
      .order("starts_at")
      .order("id")
      .range(page * 25, page * 25 + 24)
      .then(({ data, error, count }) => {
        if (!valid()) return;
        setLoading(false);
        if (error) {
          setMessage("Não foi possível carregar a agenda.");
          return;
        }
        if (page > 0 && page * 25 >= (count || 0)) {
          setPage(Math.max(0, Math.ceil((count || 0) / 25) - 1));
          return;
        }
        setRows((data || []) as unknown as Appointment[]);
        setTotal(count || 0);
        setReady(true);
      });
    return () => reads.current.invalidate();
  }, [
    org,
    userId,
    client?.id,
    day,
    days,
    filter,
    professionalFilter,
    page,
    revision,
  ]);
  function clearList() {
    reads.current.invalidate();
    setRows([]);
    setReady(false);
  }
  function resetEditor() {
    setEditing(null);
    setSelected(client || null);
    setProfessional(userId);
    setStart(day + "T09:00");
    setDuration(60);
    setKind("session");
    setConflict(false);
  }
  function period(next: string, length = days) {
    if (next === day && length === days) return;
    if (
      editing &&
      !window.confirm("Fechar a edição da marcação e mudar o período?")
    )
      return;
    resetEditor();
    setStart(next + "T09:00");
    clearList();
    setDay(next);
    setDays(length);
    setPage(0);
    setMessage("");
  }
  function reloadList() {
    if (
      editing &&
      !window.confirm(
        "Descartar alterações da marcação e carregar a agenda atual?",
      )
    )
      return;
    resetEditor();
    setPage(0);
    setRevision((v) => v + 1);
  }
  const allowed = (a: Appointment) => manager || a.professional_id === userId;
  function edit(a: Appointment) {
    if (!allowed(a)) return;
    setEditing(a);
    setSelected({
      id: a.client_id,
      organization_id: org,
      full_name: a.clients?.full_name || "Aluno",
      archived_at: a.clients?.archived_at || null,
    });
    setStart(localDateTime(a.starts_at));
    setDuration(
      Math.round((Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60000),
    );
    setProfessional(a.professional_id || userId);
    setKind(a.kind);
    setConflict(false);
    setMessage("");
  }
  async function persist(
    a: Appointment | null,
    status: Appointment["status"],
    form = false,
  ) {
    if (!db || busy || !rosterReady || conflict) return;
    const target = form ? selected : null;
    if (form && (!target || target.archived_at)) {
      setMessage("Seleciona um aluno ativo.");
      return;
    }
    let begins: string, ends: string;
    try {
      begins = form ? appointmentInstant(start) : a!.starts_at;
      ends = form
        ? new Date(Date.parse(begins) + duration * 60000).toISOString()
        : a!.ends_at;
      if (duration < 5 || duration > 480)
        throw new Error("Indica uma duração entre 5 e 480 minutos.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Data inválida.");
      return;
    }
    if (
      !form &&
      !window.confirm(
        `${appointmentStatuses[status]}: confirmar alteração da marcação de ${a?.clients?.full_name || "este aluno"}?`,
      )
    )
      return;
    if (
      form &&
      a?.status === "cancelled" &&
      !window.confirm("Reagendar esta marcação cancelada?")
    )
      return;
    const valid = writes.current.begin();
    setBusy(true);
    setMessage("");
    try {
      const r = await db.rpc("aura_appointment_save", {
        p_org: org,
        p_id: a?.id || null,
        p_client: form ? target!.id : a!.client_id,
        p_professional: form ? professional : a!.professional_id,
        p_kind: form ? kind : a!.kind,
        p_status: status,
        p_start: begins,
        p_end: ends,
        p_revision: a ? Number(a.revision) : 0,
      });
      if (!valid()) return;
      if (r.error) {
        setMessage(careError(r.error));
        if (
          r.error.code === "PT409" &&
          !r.error.message.includes("Slot unavailable")
        )
          setConflict(true);
        return;
      }
      resetEditor();
      setPage(0);
      if (form) {
        setDay(start.slice(0, 10));
        setStart(start.slice(0, 10) + "T09:00");
      }
      setRevision((v) => v + 1);
      setMessage(form ? "Marcação guardada." : "Marcação atualizada.");
    } catch {
      if (valid()) setMessage("Falha de ligação ao guardar marcação.");
    } finally {
      if (valid()) setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void persist(editing, "scheduled", true);
  }
  const chosen = selected?.organization_id === org ? selected : null;
  return (
    <>
      <section className="panel">
        <div className="aura-section-title">
          <h2>Marcações</h2>
          <button
            className="outline"
            disabled={busy || loading}
            onClick={reloadList}
          >
            Atualizar agenda
          </button>
        </div>
        <div className="aura-agenda-toolbar">
          <button
            className="outline"
            disabled={busy || !day}
            onClick={() => period(addDays(day, -days))}
          >
            Período anterior
          </button>
          <label>
            Data da agenda
            <input
              type="date"
              min="2000-01-01"
              max="2100-12-31"
              value={day}
              disabled={busy}
              onChange={(e) => period(e.target.value)}
            />
          </label>
          <label>
            Período
            <select
              value={days}
              disabled={busy}
              onChange={(e) => period(day, Number(e.target.value))}
            >
              <option value={1}>Dia</option>
              <option value={7}>7 dias</option>
            </select>
          </label>
          <button
            className="outline"
            disabled={busy || !day}
            onClick={() => period(addDays(day, days))}
          >
            Período seguinte
          </button>
        </div>
        <div className="columns">
          <label>
            Estado das marcações
            <select
              value={filter}
              disabled={busy}
              onChange={(e) => {
                clearList();
                setPage(0);
                setFilter(e.target.value);
              }}
            >
              <option value="">Todos</option>
              {Object.entries(appointmentStatuses).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Filtrar profissional
            <select
              value={professionalFilter}
              disabled={busy || !rosterReady}
              onChange={(e) => {
                clearList();
                setPage(0);
                setProfessionalFilter(e.target.value);
              }}
            >
              <option value="">Toda a equipa</option>
              {professionals.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.user_id === userId ? "Tu" : p.display_name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p>
          Horários em Europe/Lisbon. {total} marcações no período e filtros
          selecionados.
        </p>
        {loading ? (
          <p role="status">A carregar agenda...</p>
        ) : !ready ? (
          <p role="alert">
            Agenda indisponível. Usa «Atualizar agenda» para tentar novamente.
          </p>
        ) : !rows.length ? (
          <div className="aura-empty-state">
            <strong>Sem marcações neste período</strong>
            <p>Cria uma marcação ou ajusta a data e os filtros.</p>
          </div>
        ) : (
          <ul className="aura-appointment-list">
            {rows.map((a) => (
              <li key={a.id}>
                <div>
                  <strong>
                    {appointmentKinds[a.kind]} ·{" "}
                    {a.clients?.full_name || "Aluno indisponível"}
                  </strong>
                  <p>
                    {formatAppointment(a.starts_at)} —{" "}
                    {new Intl.DateTimeFormat("pt-PT", {
                      timeZone: "Europe/Lisbon",
                      timeStyle: "short",
                    }).format(new Date(a.ends_at))}
                  </p>
                  <small>
                    {appointmentStatuses[a.status]} ·{" "}
                    {a.professional_id === userId
                      ? "Tu"
                      : professionals.find(
                          (p) => p.user_id === a.professional_id,
                        )?.display_name || "Profissional removido"}
                    {a.clients?.archived_at ? " · Aluno arquivado" : ""}
                  </small>
                </div>
                <div className="aura-quick-actions">
                  <a
                    className="outline link"
                    href={clientProfileUrl(org, a.client_id)}
                  >
                    Ficha do aluno
                  </a>
                  {a.kind === "assessment" && !a.clients?.archived_at && (
                    <a
                      className="outline link"
                      href={`/avaliacoes?org=${org}&aluno=${a.client_id}`}
                    >
                      Registar avaliação
                    </a>
                  )}
                  {allowed(a) && (
                    <>
                      {(a.status === "scheduled" || a.status === "cancelled") &&
                        !a.clients?.archived_at && (
                          <button
                            className="outline"
                            disabled={busy || conflict}
                            onClick={() => edit(a)}
                          >
                            {a.status === "cancelled"
                              ? "Reagendar"
                              : "Editar marcação"}
                          </button>
                        )}
                      {a.status === "scheduled" && (
                        <>
                          <button
                            className="outline"
                            disabled={busy || conflict}
                            onClick={() => void persist(a, "completed")}
                          >
                            Marcar realizado
                          </button>
                          <button
                            className="outline"
                            disabled={busy || conflict}
                            onClick={() => void persist(a, "no_show")}
                          >
                            Marcar falta
                          </button>
                          <button
                            className="outline"
                            disabled={busy || conflict}
                            onClick={() => void persist(a, "cancelled")}
                          >
                            Cancelar marcação
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <nav aria-label="Paginação da agenda">
          <button
            className="outline"
            disabled={busy || loading || page === 0}
            onClick={() => {
              clearList();
              setPage((v) => v - 1);
            }}
          >
            Anterior
          </button>
          <span>
            {" "}
            Página {page + 1} de {Math.max(1, Math.ceil(total / 25))}{" "}
          </span>
          <button
            className="outline"
            disabled={busy || loading || !ready || (page + 1) * 25 >= total}
            onClick={() => {
              clearList();
              setPage((v) => v + 1);
            }}
          >
            Seguinte
          </button>
        </nav>
      </section>
      {!client?.archived_at && (
        <section className="panel">
          <h2>{editing ? "Editar marcação" : "Nova marcação"}</h2>
          {!client && (
            <ClientPicker
              org={org}
              selected={chosen}
              disabled={busy || !!editing}
              onSelect={setSelected}
            />
          )}
          {chosen && (
            <p>
              Aluno: <strong>{chosen.full_name}</strong>
              {chosen.archived_at ? " · Arquivado" : ""}
            </p>
          )}
          <form onSubmit={submit}>
            <div className="columns">
              <label>
                Tipo de marcação
                <select
                  value={kind}
                  disabled={busy || conflict}
                  onChange={(e) =>
                    setKind(e.target.value as Appointment["kind"])
                  }
                >
                  {Object.entries(appointmentKinds).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Profissional da marcação
                <select
                  value={professional}
                  disabled={!manager || busy || !rosterReady || conflict}
                  onChange={(e) => setProfessional(e.target.value)}
                >
                  {professionals.map((p) => (
                    <option key={p.user_id} value={p.user_id}>
                      {p.user_id === userId ? "Tu" : p.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Data e hora (Lisboa)
                <input
                  type="datetime-local"
                  required
                  min="2000-01-01T00:00"
                  max="2100-12-31T23:59"
                  disabled={busy || conflict}
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                Duração (minutos)
                <input
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  required
                  disabled={busy || conflict}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
              </label>
            </div>
            <button
              disabled={
                busy ||
                !rosterReady ||
                !chosen ||
                !!chosen.archived_at ||
                conflict
              }
            >
              {editing ? "Guardar alterações da marcação" : "Guardar marcação"}
            </button>
            {editing && (
              <button
                type="button"
                className="outline"
                disabled={busy}
                onClick={resetEditor}
              >
                Fechar edição
              </button>
            )}
          </form>
        </section>
      )}
      <p role="status" className="status">
        {message}
      </p>
      {conflict && (
        <p role="alert">
          Atualiza a agenda antes de continuar. Alterações não foram
          sobrescritas.
        </p>
      )}
    </>
  );
}
