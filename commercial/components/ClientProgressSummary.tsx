import { measurementSummary } from "../lib/care";
export default function ClientProgressSummary({
  records,
}: {
  records: {
    assessed_on: string;
    weight_kg: number | null;
    height_cm: number | null;
    waist_cm: number | null;
  }[];
}) {
  const labels = {
    weight_kg: "Peso",
    height_cm: "Altura",
    waist_cm: "Cintura",
  };
  return (
    <section className="panel">
      <h2>Resumo da evolução</h2>
      <div className="aura-summary-grid">
        {measurementSummary(records).map((s) => (
          <div key={s.key}>
            <span>{labels[s.key]}</span>
            <strong>
              {s.value === null
                ? "Sem medição"
                : `${s.value} ${s.key === "weight_kg" ? "kg" : "cm"}`}
            </strong>
            <small>{s.date || "Regista a primeira avaliação"}</small>
            {s.delta !== null && (
              <p>
                {s.delta > 0 ? "+" : ""}
                {s.delta} {s.key === "weight_kg" ? "kg" : "cm"} face à medição
                anterior
              </p>
            )}
          </div>
        ))}
      </div>
      <p>
        Comparação das medições disponíveis nas últimas 30 avaliações, sem
        interpretação clínica.
      </p>
    </section>
  );
}
