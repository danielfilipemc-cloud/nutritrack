export const CARE_TIME_ZONE = "Europe/Lisbon";
export const followupLabels = {
  active: "Em acompanhamento",
  paused: "Em pausa",
  completed: "Concluído",
};
export const appointmentKinds = {
  session: "Sessão",
  assessment: "Avaliação",
  review: "Revisão",
};
export const appointmentStatuses = {
  scheduled: "Agendado",
  completed: "Realizado",
  cancelled: "Cancelado",
  no_show: "Faltou",
};
export type Professional = {
  user_id: string;
  display_name: string;
  role: "owner" | "admin" | "coach";
};
export type Followup = {
  goal: string;
  status: keyof typeof followupLabels;
  responsible_id: string | null;
  next_review: string | null;
  revision: number;
};
export type Appointment = {
  id: string;
  organization_id: string;
  client_id: string;
  professional_id: string | null;
  kind: keyof typeof appointmentKinds;
  status: keyof typeof appointmentStatuses;
  starts_at: string;
  ends_at: string;
  revision: number;
  clients: { full_name: string; archived_at: string | null } | null;
};

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CARE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export function localDateTime(instant: string | Date): string {
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(instant)).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function businessToday(now = new Date()) {
  return localDateTime(now).slice(0, 10);
}

// Resolve a local civil time explicitly. Reject gaps and repeated hours instead
// of silently choosing an instant at a daylight-saving transition.
export function appointmentInstant(local: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error("Indica data e hora válidas.");
  const naive = Date.parse(local + ":00Z");
  if (
    !Number.isFinite(naive) ||
    new Date(naive).toISOString().slice(0, 16) !== local ||
    local.slice(0, 4) < "2000" ||
    local.slice(0, 4) > "2100"
  )
    throw new Error("Indica data e hora válidas.");
  const offsets = new Set<number>();
  for (let h = -36; h <= 36; h += 12) {
    const sample = naive + h * 3600000;
    offsets.add(Date.parse(localDateTime(new Date(sample)) + ":00Z") - sample);
  }
  const candidates = [...offsets]
    .map((offset) => naive - offset)
    .filter((instant) => localDateTime(new Date(instant)) === local);
  if (candidates.length !== 1)
    throw new Error(
      "Hora inexistente ou ambígua devido à mudança de hora. Escolhe outro horário.",
    );
  return new Date(candidates[0]).toISOString();
}
export function addDays(date: string, days: number) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function agendaRange(date: string, days: number) {
  return {
    start: appointmentInstant(date + "T00:00"),
    end: appointmentInstant(addDays(date, days) + "T00:00"),
  };
}
export function formatAppointment(instant: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: CARE_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(instant));
}
export function careError(error: { code?: string; message?: string } | null) {
  if (error?.code === "PT409")
    return error.message?.includes("Slot unavailable")
      ? "Aluno ou profissional já tem uma marcação nesse horário."
      : "O registo mudou ou já foi finalizado. Atualiza antes de tentar novamente.";
  if (error?.code === "23514")
    return "O aluno está arquivado. Reativa-o para continuar o acompanhamento.";
  if (error?.code === "42501")
    return "Não tens autorização para esta operação. Atualiza os teus acessos.";
  return "Não foi possível guardar. Confirma os dados e tenta novamente.";
}
export function measurementSummary(
  records: {
    assessed_on: string;
    weight_kg: number | null;
    height_cm: number | null;
    waist_cm: number | null;
  }[],
) {
  const sorted = [...records].sort((a, b) =>
    b.assessed_on.localeCompare(a.assessed_on),
  );
  return (["weight_kg", "height_cm", "waist_cm"] as const).map((key) => {
    const values = sorted.filter(
      (r) => r[key] !== null && Number.isFinite(Number(r[key])),
    );
    return {
      key,
      value: values[0]?.[key] ?? null,
      date: values[0]?.assessed_on ?? null,
      delta:
        values.length > 1
          ? Math.round(
              (Number(values[0][key]) - Number(values[1][key])) * 100,
            ) / 100
          : null,
    };
  });
}
