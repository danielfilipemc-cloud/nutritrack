import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appointmentInstant,
  localDateTime,
  agendaRange,
  measurementSummary,
} from "../lib/care";

test("agenda resolves Lisbon independently of browser timezone and rejects DST gaps/repeated hours", () => {
  assert.equal(
    appointmentInstant("2026-07-10T10:30"),
    "2026-07-10T09:30:00.000Z",
  );
  assert.equal(
    appointmentInstant("2026-12-10T10:30"),
    "2026-12-10T10:30:00.000Z",
  );
  assert.throws(
    () => appointmentInstant("2026-03-29T01:30"),
    /mudança de hora/,
  );
  assert.throws(
    () => appointmentInstant("2026-10-25T01:30"),
    /mudança de hora/,
  );
  for (const value of [
    "2026-02-30T10:30",
    "2026-01-01T25:00",
    "2101-01-01T12:00",
    "",
  ])
    assert.throws(() => appointmentInstant(value));
  assert.equal(localDateTime("2026-07-10T09:30:00Z"), "2026-07-10T10:30");
  const spring = agendaRange("2026-03-29", 1),
    autumn = agendaRange("2026-10-25", 1);
  assert.equal(
    (Date.parse(spring.end) - Date.parse(spring.start)) / 3600000,
    23,
  );
  assert.equal(
    (Date.parse(autumn.end) - Date.parse(autumn.start)) / 3600000,
    25,
  );
});
test("measurement summaries compare available values without modifying input or inferring health", () => {
  const records = [
    {
      assessed_on: "2026-01-01",
      weight_kg: 80,
      height_cm: 175,
      waist_cm: null,
    },
    {
      assessed_on: "2026-02-01",
      weight_kg: null,
      height_cm: null,
      waist_cm: 90,
    },
    {
      assessed_on: "2026-03-01",
      weight_kg: 79.25,
      height_cm: null,
      waist_cm: 89,
    },
  ];
  const saved = JSON.stringify(records),
    result = measurementSummary(records);
  assert.deepEqual(result[0], {
    key: "weight_kg",
    value: 79.25,
    date: "2026-03-01",
    delta: -0.75,
  });
  assert.equal(result[1].delta, null);
  assert.equal(result[2].delta, -1);
  assert.equal(JSON.stringify(records), saved);
  assert.equal(measurementSummary([])[0].value, null);
});
