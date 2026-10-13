import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { migrationBundle } from "../scripts/migration-bundle";
import { organizationPreference } from "../lib/organization-preference";
const id = (n: number) =>
  `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
async function fixture() {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
  );
  await db.exec(
    (await migrationBundle()).replace(
      "create extension if not exists pgcrypto;",
      "",
    ),
  );
  await db.exec(
    `insert into auth.users(id,email) values ('${id(1)}','owner@example.invalid'),('${id(2)}','coach@example.invalid'),('${id(3)}','admin@example.invalid'),('${id(4)}','unassigned@example.invalid'),('${id(5)}','second@example.invalid');insert into organizations(id,name) values ('${id(10)}','Studio A'),('${id(20)}','Studio B');insert into organization_members(organization_id,user_id,role) values ('${id(10)}','${id(1)}','owner'),('${id(10)}','${id(2)}','coach'),('${id(10)}','${id(5)}','coach'),('${id(20)}','${id(3)}','admin');insert into clients(id,organization_id,full_name) values ('${id(100)}','${id(10)}','Client A'),('${id(101)}','${id(10)}','Client second'),('${id(200)}','${id(20)}','Client B');`,
  );
  return {
    db,
    asUser: async (n: number) => {
      await db.exec(
        `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id(n)}',false)`,
      );
    },
    denied: async (sql: string, code = "42501") =>
      assert.rejects(db.exec(sql), (e: any) => e.code === code),
  };
}
const follow = (
  revision = 0,
  responsible: number | null = 2,
  goal = "Private objective",
  status = "active",
  review = "null",
) =>
  `select aura_followup_save('${id(10)}','${id(100)}','${goal}','${status}',${responsible === null ? "null" : `'${id(responsible)}'`},${review},${revision})`;
const appointment = (
  a: {
    id?: string;
    client?: number;
    professional?: number | null;
    revision?: number;
    status?: string;
    start?: string;
    end?: string;
    org?: number;
  } = {},
) =>
  `select aura_appointment_save('${id(a.org ?? 10)}',${a.id ? `'${a.id}'` : "null"},'${id(a.client ?? 100)}',${a.professional === null ? "null" : `'${id(a.professional ?? 2)}'`},'session','${a.status || "scheduled"}','${a.start || "2026-12-10T10:00Z"}','${a.end || "2026-12-10T11:00Z"}',${a.revision ?? 0}) value`;

test("follow-up permissions, optimistic revisions, history minimization and archived read-only", async () => {
  const { db, asUser, denied } = await fixture();
  try {
    await asUser(1);
    await db.exec(follow());
    await denied(follow(0), "PT409");
    await denied(follow(1, 3), "22023");
    await denied(follow(1, 2, "x".repeat(1001)), "22023");
    await asUser(2);
    await db.exec(follow(1, 2, "Updated objective"));
    await denied(follow(2, 1));
    await denied(
      `select aura_followup_save('${id(10)}','${id(200)}','Foreign','active',null,null,0)`,
    );
    await denied("update client_followups set goal='Bypass'");
    await denied("delete from client_followups");
    await denied("select * from app_private.care_events");
    const history = (
      await db.query<{ action: string }>(
        `select * from aura_care_history('${id(10)}','${id(100)}')`,
      )
    ).rows;
    assert.equal(history.length, 2);
    assert.ok(!JSON.stringify(history).includes("objective"));
    const row = (
      await db.query<{ revision: number; updated_by: string }>(
        `select revision,updated_by from client_followups`,
      )
    ).rows[0];
    assert.equal(Number(row.revision), 2);
    assert.equal(row.updated_by, id(2));
    const choices = (
      await db.query<{ user_id: string }>(
        `select * from aura_professional_choices('${id(10)}')`,
      )
    ).rows;
    assert.equal(choices.length, 3);
    assert.ok(!JSON.stringify(choices).includes("@"));
    await asUser(3);
    assert.equal(
      (await db.query("select * from client_followups")).rows.length,
      0,
    );
    await denied(follow(2));
    await denied(`select * from aura_professional_choices('${id(10)}')`);
    await denied(`select * from aura_care_history('${id(10)}','${id(100)}')`);
    await asUser(4);
    await denied(follow());
    await asUser(1);
    await db.exec(
      `select aura_client_change('${id(10)}','${id(100)}','Client A',true,1)`,
    );
    await denied(follow(2), "23514");
    await db.exec("reset role;set role anon");
    await denied(follow());
  } finally {
    await db.close();
  }
});

test("agenda checks tenant/client/staff, overlapping slots, adjacency and terminal states", async () => {
  const { db, asUser, denied } = await fixture();
  try {
    await asUser(1);
    const appt = (await db.query<{ value: string }>(appointment())).rows[0]
      .value;
    await denied(appointment({ client: 101 }), "PT409"); // Same professional.
    await denied(appointment({ professional: 1 }), "PT409"); // Same client, different professional.
    await denied(appointment({ client: 200 }));
    await denied(appointment({ client: 101, professional: 3 }), "22023");
    await denied(
      appointment({
        client: 101,
        start: "2026-12-10T10:00Z",
        end: "2026-12-11T10:00Z",
      }),
      "22023",
    );
    await db.exec(
      appointment({
        client: 101,
        start: "2026-12-10T11:00Z",
        end: "2026-12-10T12:00Z",
      }),
    ); // Adjacent is allowed.
    await asUser(5);
    await denied(
      appointment({
        id: appt,
        revision: 1,
        status: "cancelled",
        professional: 5,
      }),
    );
    await asUser(2);
    await denied(
      appointment({
        professional: 1,
        start: "2026-12-11T10:00Z",
        end: "2026-12-11T11:00Z",
      }),
    );
    await db.exec(appointment({ id: appt, revision: 1, status: "cancelled" }));
    await denied(appointment({ id: appt, revision: 1 }), "PT409");
    await db.exec(appointment({ id: appt, revision: 2 }));
    await db.exec(appointment({ id: appt, revision: 3, status: "completed" }));
    await denied(appointment({ id: appt, revision: 4 }), "PT409");
    await denied(
      "insert into appointments(organization_id,client_id,kind,status,starts_at,ends_at) values (null,null,null,null,now(),now())",
    );
    await denied("update appointments set status='cancelled'");
    await denied("delete from appointments");
    await asUser(3);
    assert.equal((await db.query("select * from appointments")).rows.length, 0);
    await denied(appointment());
    await db.exec(appointment({ org: 20, client: 200, professional: 3 }));
    await asUser(4);
    await denied(appointment());
    await db.exec("reset role;set role anon");
    await denied(appointment());
  } finally {
    await db.close();
  }
});

test("membership removal unassigns safely, increments revisions and archive preserves closure", async () => {
  const { db, asUser, denied } = await fixture();
  try {
    await asUser(1);
    await db.exec(follow());
    const appt = (await db.query<{ value: string }>(appointment())).rows[0]
      .value;
    await db.exec(
      `reset role;delete from organization_members where organization_id='${id(10)}' and user_id='${id(2)}'`,
    );
    await asUser(1);
    const state = (
      await db.query<{ responsible_id: null; revision: number }>(
        "select responsible_id,revision from client_followups",
      )
    ).rows[0];
    assert.equal(state.responsible_id, null);
    assert.equal(Number(state.revision), 2);
    const row = (
      await db.query<{ professional_id: null; revision: number }>(
        "select professional_id,revision from appointments",
      )
    ).rows[0];
    assert.equal(row.professional_id, null);
    assert.equal(Number(row.revision), 2);
    await db.exec(
      `select aura_client_change('${id(10)}','${id(100)}','Client A',true,1)`,
    );
    await denied(
      appointment({
        client: 100,
        professional: 1,
        start: "2026-12-11T10:00Z",
        end: "2026-12-11T11:00Z",
      }),
      "23514",
    );
    await db.exec(
      appointment({
        id: appt,
        revision: 2,
        professional: null,
        status: "cancelled",
      }),
    );
    assert.equal((await db.query("select * from appointments")).rows.length, 1);
    await asUser(2);
    await denied(appointment({ id: appt, revision: 3, professional: 2 }));
    await denied(`select * from aura_care_history('${id(10)}','${id(100)}')`);
  } finally {
    await db.close();
  }
});

test("care dashboard combines due reviews and scheduled Lisbon day with tenant isolation", async () => {
  const { db, asUser, denied } = await fixture();
  try {
    await asUser(1);
    await db.exec(
      follow(
        0,
        2,
        "Goal",
        "active",
        "(now() at time zone 'Europe/Lisbon')::date",
      ),
    );
    await db.exec(
      `select aura_appointment_save('${id(10)}',null,'${id(100)}','${id(2)}','review','scheduled',((now() at time zone 'Europe/Lisbon')::date+time '10:00') at time zone 'Europe/Lisbon',((now() at time zone 'Europe/Lisbon')::date+time '11:00') at time zone 'Europe/Lisbon',0)`,
    );
    const d = (
      await db.query<{ value: any }>(
        `select aura_care_dashboard('${id(10)}') value`,
      )
    ).rows[0].value;
    assert.equal(d.reviews_due, 1);
    assert.equal(d.appointments_today, 1);
    assert.equal(d.today_appointments.length, 1);
    assert.equal(d.due_reviews.length, 1);
    assert.equal(d.time_zone, "Europe/Lisbon");
    assert.ok(!JSON.stringify(d).includes("Goal"));
    await db.exec(
      follow(
        1,
        2,
        "Goal",
        "paused",
        "(now() at time zone 'Europe/Lisbon')::date",
      ),
    );
    assert.equal(
      (
        await db.query<{ value: any }>(
          `select aura_care_dashboard('${id(10)}') value`,
        )
      ).rows[0].value.reviews_due,
      0,
    );
    await asUser(3);
    await denied(`select aura_care_dashboard('${id(10)}')`);
  } finally {
    await db.close();
  }
});

test("organization navigation preference cannot select a foreign or revoked membership", () => {
  assert.equal(organizationPreference(["a", "b"], "foreign", "b"), "b");
  assert.equal(organizationPreference(["a"], "b", "foreign"), "a");
  assert.equal(organizationPreference([], "a"), "");
});
