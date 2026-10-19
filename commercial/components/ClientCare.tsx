"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { db } from "../lib/supabase";
import { RequestScope } from "../lib/request-scope";
import {
  followupLabels,
  appointmentStatuses,
  careError,
  type Followup,
  type Professional,
} from "../lib/care";
import type { SelectedClient } from "./ClientPicker";
const empty: Followup = {
  goal: "",
  status: "active",
  responsible_id: null,
  next_review: null,
  revision: 0,
};
type CareEvent = {
  id: string;
  actor_id: string | null;
  action: string;
  revision: number;
  from_status: string | null;
  to_status: string | null;
  created_at: string;
};
const eventLabels: Record<string, string> = {
  followup_created: "Acompanhamento criado",
  followup_updated: "Acompanhamento atualizado",
  appointment_created: "Marcação criada",
  appointment_updated: "Marcação alterada",
  appointment_status: "Estado da marcação alterado",
};
export default function ClientCare({
  org,
  userId,
  client,
  manager,
  writable=true,
  onDirtyChange,
  onSaved,
}: {
  org: string;
  userId: string;
  client: SelectedClient;
  manager: boolean;
  writable?: boolean;
  onDirtyChange?: (dirty: boolean,pending?:boolean) => void;
  onSaved?:()=>void;
}) {
  const scope = useRef(new RequestScope()),
    historyScope = useRef(new RequestScope());
  const [saved, setSaved] = useState<Followup>(empty),
    [draft, setDraft] = useState<Followup>(empty),
    [professionals, setProfessionals] = useState<Professional[]>([]);
  const [ready, setReady] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [reload, setReload] = useState(0),
    [conflict, setConflict] = useState(false);
  const [events, setEvents] = useState<CareEvent[]>([]),
    [page, setPage] = useState(0),
    [historyLoading, setHistoryLoading] = useState(false),
    [historyError, setHistoryError] = useState("");
  useEffect(() => {
    if (!db) return;
    const valid = scope.current.begin();
    setReady(false);
    setLoading(true);
    setConflict(false);
    setSaved(empty);
    setDraft(empty);
    setProfessionals([]);
    void Promise.all([
      db
        .from("client_followups")
        .select("goal,status,responsible_id,next_review,revision")
        .eq("organization_id", org)
        .eq("client_id", client.id)
        .maybeSingle(),
      db.rpc("aura_professional_choices", { p_org: org }),
    ]).then(([f, p]) => {
      if (!valid()) return;
      setLoading(false);
      if (f.error || p.error) {
        setMessage("Não foi possível carregar o acompanhamento.");
        return;
      }
      const value = f.data
        ? { ...f.data, revision: Number(f.data.revision) }
        : empty;
      setSaved(value);
      setDraft(value);
      setProfessionals(p.data || []);
      setReady(true);
    }).catch(() => {if(valid()){setLoading(false);setMessage('Não foi possível carregar o acompanhamento. Atualiza para tentar novamente.');}});
    return () => scope.current.invalidate();
  }, [org, userId, client.id, reload]);
  useEffect(() => {
    if (!db) return;
    const valid = historyScope.current.begin();
    setEvents([]);
    setHistoryLoading(true);
    setHistoryError("");
    void Promise.resolve(db
      .rpc("aura_care_history", {
        p_org: org,
        p_client: client.id,
        p_offset: page * 25,
      }))
      .then(({ data, error }) => {
        if (!valid()) return;
        setHistoryLoading(false);
        if (error) {
          setHistoryError("Não foi possível carregar o histórico.");
          return;
        }
        setEvents(data || []);
      }).catch(() => {if(valid()){setHistoryLoading(false);setHistoryError('Não foi possível carregar o histórico.');}});
    return () => historyScope.current.invalidate();
  }, [org, userId, client.id, page, reload]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useEffect(() => {
    onDirtyChange?.(dirty,busy);
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty || busy) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      onDirtyChange?.(false);
      window.removeEventListener("beforeunload", handler);
    };
  }, [dirty, busy, onDirtyChange]);
  function reloadData() {
    if (
      dirty &&
      !window.confirm(
        "Descartar as alterações locais e carregar a versão atual?",
      )
    )
      return;
    setMessage("");
    setReload((v) => v + 1);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!db || !ready || busy || client.archived_at || conflict || !writable) return;
    if (
      draft.status === "completed" &&
      saved.status !== "completed" &&
      !window.confirm(
        "Concluir este acompanhamento? O histórico e as avaliações serão preservados.",
      )
    )
      return;
    const valid = scope.current.begin();
    setBusy(true);
    setMessage("");
    try {
      const r = await db.rpc("aura_followup_save", {
        p_org: org,
        p_client: client.id,
        p_goal: draft.goal.trim(),
        p_status: draft.status,
        p_responsible: draft.responsible_id,
        p_review: draft.next_review || null,
        p_revision: saved.revision,
      });
      if (!valid()) return;
      if (r.error) {
        setMessage(careError(r.error));
        if (r.error.code === "PT409") setConflict(true);
        return;
      }
      const value = {
        ...draft,
        goal: draft.goal.trim(),
        revision: Number(r.data),
      };
      setDraft(value);
      setSaved(value);
      setPage(0);
      setReload((v) => v + 1);
      setMessage("Acompanhamento guardado.");
      onSaved?.();
    } catch {
      if (valid()) setMessage("Falha de ligação ao guardar acompanhamento.");
    } finally {
      if (valid()) setBusy(false);
    }
  }
  const disabled = !ready || busy || !!client.archived_at || conflict || !writable;
  return (
    <>
      <section className="panel" aria-busy={loading}>
        <div className="aura-section-title">
          <h2>Plano de acompanhamento</h2>
          <button
            type="button"
            className="outline"
            disabled={busy || loading}
            onClick={reloadData}
          >
            Recarregar ficha
          </button>
        </div>
        {loading ? (
          <p role="status">A carregar acompanhamento...</p>
        ) : !ready ? (
          <p role="alert">{message}</p>
        ) : (
          <form onSubmit={save}>
            <label>
              Objetivo do acompanhamento
              <textarea
                rows={3}
                maxLength={1000}
                value={draft.goal}
                disabled={disabled}
                placeholder="Objetivo acordado e foco das próximas sessões"
                onChange={(e) => setDraft({ ...draft, goal: e.target.value })}
              />
            </label>
            <div className="columns">
              <label>
                Estado do acompanhamento
                <select
                  value={draft.status}
                  disabled={disabled}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      status: e.target.value as Followup["status"],
                    })
                  }
                >
                  {Object.entries(followupLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Profissional responsável
                <select
                  value={draft.responsible_id || ""}
                  disabled={disabled || !manager}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      responsible_id: e.target.value || null,
                    })
                  }
                >
                  <option value="">Por atribuir</option>
                  {professionals.map((p) => (
                    <option key={p.user_id} value={p.user_id}>
                      {p.user_id === userId ? "Tu" : p.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Próxima revisão
                <input
                  type="date"
                  min="2000-01-01"
                  max="2100-12-31"
                  disabled={disabled}
                  value={draft.next_review || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, next_review: e.target.value || null })
                  }
                />
              </label>
            </div>
            {!manager && (
              <p>A atribuição de responsável é gerida pelos administradores.</p>
            )}
            {client.archived_at ? (
              <p>
                Aluno arquivado: acompanhamento disponível apenas para consulta.
              </p>
            ) : (
              <button disabled={disabled || !dirty}>
                Guardar acompanhamento
              </button>
            )}
          </form>
        )}
        <p role="status" className="status">
          {loading ? "" : message}
        </p>
        {conflict && (
          <p role="alert">
            As tuas alterações foram mantidas no formulário. Recarrega a ficha
            antes de voltar a guardar.
          </p>
        )}
      </section>
      <section className="panel" aria-busy={historyLoading}>
        <h2>Histórico de acompanhamento</h2>
        {historyLoading ? (
          <p role="status">A carregar histórico...</p>
        ) : historyError ? (
          <p role="alert">{historyError}</p>
        ) : !events.length ? (
          <p>O histórico aparecerá após a primeira alteração ou marcação.</p>
        ) : (
          <ul className="aura-activity-list">
            {events.map((e) => (
              <li key={e.id}>
                <strong>
                  {eventLabels[e.action] || "Alteração registada"}
                </strong>
                <span>
                  {new Date(e.created_at).toLocaleString("pt-PT", {
                    timeZone: "Europe/Lisbon",
                  })}{" "}
                  ·{" "}
                  {e.actor_id === userId
                    ? "Tu"
                    : professionals.find((p) => p.user_id === e.actor_id)
                        ?.display_name || "Profissional removido"}
                </span>
                {e.action === "appointment_status" && (
                  <small>
                    {appointmentStatuses[
                      e.from_status as keyof typeof appointmentStatuses
                    ] || e.from_status}{" "}
                    →{" "}
                    {appointmentStatuses[
                      e.to_status as keyof typeof appointmentStatuses
                    ] || e.to_status}
                  </small>
                )}
              </li>
            ))}
          </ul>
        )}
        <nav aria-label="Paginação do acompanhamento">
          <button
            className="outline"
            disabled={historyLoading || page === 0}
            onClick={() => setPage((v) => v - 1)}
          >
            Anterior
          </button>
          <span> Página {page + 1} </span>
          <button
            className="outline"
            disabled={historyLoading || !!historyError || events.length < 25}
            onClick={() => setPage((v) => v + 1)}
          >
            Seguinte
          </button>
        </nav>
      </section>
    </>
  );
}
