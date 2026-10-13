import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { businessToday } from "../lib/care";
process.loadEnvFile(".env.local");
process.loadEnvFile(".env.admin.local");
process.loadEnvFile(".aura-integration/accounts.env");
const boundedFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(20000) });
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    secret = process.env.SUPABASE_SECRET_KEY;
  assert.equal(url, "https://vfplbkfxipfictuwkkoe.supabase.co");
  assert.ok(key?.startsWith("sb_publishable_"));
  assert.ok(secret?.startsWith("sb_secret_"));
  const fixture = JSON.parse(
    await readFile(".aura-integration/fixture.json", "utf8"),
  );
  assert.equal(fixture.project, new URL(url!).hostname);
  const admin = createClient(url!, secret!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { fetch: boundedFetch },
    }),
    sessions: SupabaseClient[] = [],
    users: string[] = [];
  const marker = `AURA-care-${randomUUID()}`;
  const own = [
    { id: randomUUID(), organization_id: fixture.oa, full_name: marker + " A" },
    {
      id: randomUUID(),
      organization_id: fixture.oa,
      full_name: marker + " Second",
    },
  ];
  const foreign = {
    id: randomUUID(),
    organization_id: fixture.ob,
    full_name: marker + " B",
  };
  const denied = (r: { error: { code?: string } | null }, code = "42501") =>
    assert.equal(r.error?.code, code);
  try {
    for (const role of ["OWNER_A", "ADMIN_B", "COACH_A", "UNASSIGNED"]) {
      const db: SupabaseClient = createClient(url!, key!, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: { fetch: boundedFetch },
      });
      sessions.push(db);
      const auth = await db.auth.signInWithPassword({
        email: process.env[`AURA_TEST_${role}_EMAIL`]!,
        password: process.env[`AURA_TEST_${role}_PASSWORD`]!,
      });
      assert.equal(auth.error, null);
      assert.ok(auth.data.user);
      users.push(auth.data.user.id);
    }
    const [owner, adminB, coach, unassigned] = sessions;
    assert.equal((await owner.from("clients").insert(own)).error, null);
    assert.equal((await adminB.from("clients").insert(foreign)).error, null);
    const follow = (
      db: SupabaseClient,
      revision: number,
      extra: Record<string, unknown> = {},
    ) =>
      db.rpc("aura_followup_save", {
        p_org: fixture.oa,
        p_client: own[0].id,
        p_goal: "Synthetic follow-up objective",
        p_status: "active",
        p_responsible: users[2],
        p_review: businessToday(),
        p_revision: revision,
        ...extra,
      });
    assert.equal((await follow(owner, 0)).error, null);
    const race = await Promise.all([
      follow(owner, 1, { p_goal: "Synthetic first" }),
      follow(coach, 1, { p_goal: "Synthetic second" }),
    ]);
    assert.equal(race.filter((r) => !r.error).length, 1);
    assert.equal(race.filter((r) => r.error?.code === "PT409").length, 1);
    denied(await follow(coach, 2, { p_responsible: users[0] }));
    denied(await follow(adminB, 2));
    denied(await follow(unassigned, 2));
    denied(
      await owner
        .from("client_followups")
        .update({ goal: "Bypass" })
        .eq("client_id", own[0].id),
    );
    for (const table of ["client_followups", "appointments"]) {
      const foreignRead = await adminB
        .from(table)
        .select("*")
        .eq("organization_id", fixture.oa);
      assert.equal(foreignRead.error, null);
      assert.equal(foreignRead.data?.length, 0);
    }
    const slots = {
      p_org: fixture.oa,
      p_id: null,
      p_client: own[0].id,
      p_professional: users[2],
      p_kind: "session",
      p_status: "scheduled",
      p_start: "2090-01-10T10:00:00Z",
      p_end: "2090-01-10T11:00:00Z",
      p_revision: 0,
    };
    const concurrent = await Promise.all([
      owner.rpc("aura_appointment_save", slots),
      coach.rpc("aura_appointment_save", { ...slots, p_client: own[1].id }),
    ]);
    assert.equal(concurrent.filter((r) => !r.error).length, 1);
    assert.equal(concurrent.filter((r) => r.error?.code === "PT409").length, 1);
    const appointmentId = concurrent.find((r) => !r.error)!.data as string;
    const saved = await owner
      .from("appointments")
      .select("*")
      .eq("organization_id", fixture.oa)
      .eq("id", appointmentId)
      .single();
    assert.equal(saved.error, null);
    assert.ok(saved.data);
    const selectedClient = saved.data.client_id as string;
    denied(
      await adminB.rpc("aura_appointment_save", {
        ...slots,
        p_id: appointmentId,
        p_client: selectedClient,
        p_revision: 1,
        p_status: "cancelled",
      }),
    );
    denied(await unassigned.rpc("aura_appointment_save", slots));
    denied(
      await coach.rpc("aura_appointment_save", {
        ...slots,
        p_professional: users[0],
        p_start: "2090-01-11T10:00:00Z",
        p_end: "2090-01-11T11:00:00Z",
      }),
    );
    const cancel = {
      ...slots,
      p_id: appointmentId,
      p_client: selectedClient,
      p_revision: 1,
      p_status: "cancelled",
    };
    assert.equal(
      (await coach.rpc("aura_appointment_save", cancel)).error,
      null,
    );
    denied(
      await owner.rpc("aura_appointment_save", {
        ...cancel,
        p_status: "scheduled",
      }),
      "PT409",
    );
    assert.equal(
      (
        await owner.rpc("aura_appointment_save", {
          ...cancel,
          p_revision: 2,
          p_status: "scheduled",
        })
      ).error,
      null,
    );
    const original = await owner
      .from("clients")
      .select("revision,full_name")
      .eq("organization_id", fixture.oa)
      .eq("id", selectedClient)
      .single();
    assert.equal(original.error, null);
    assert.equal(
      (
        await owner.rpc("aura_client_change", {
          p_org: fixture.oa,
          p_client: selectedClient,
          p_name: original.data!.full_name,
          p_archived: true,
          p_revision: original.data!.revision,
        })
      ).error,
      null,
    );
    denied(
      await owner.rpc("aura_appointment_save", {
        ...slots,
        p_client: selectedClient,
        p_start: "2090-01-11T10:00:00Z",
        p_end: "2090-01-11T11:00:00Z",
      }),
      "23514",
    );
    assert.equal(
      (await coach.rpc("aura_appointment_save", { ...cancel, p_revision: 3 }))
        .error,
      null,
    );
    const history = await owner.rpc("aura_care_history", {
      p_org: fixture.oa,
      p_client: own[0].id,
      p_offset: 0,
    });
    assert.equal(history.error, null);
    assert.ok(history.data?.length);
    assert.ok(
      !JSON.stringify(history.data).includes("Synthetic follow-up objective"),
    );
    denied(
      await adminB.rpc("aura_care_history", {
        p_org: fixture.oa,
        p_client: own[0].id,
        p_offset: 0,
      }),
    );
    for (const db of [owner, coach]) {
      const result = await db.rpc("aura_care_dashboard", { p_org: fixture.oa });
      assert.equal(result.error, null);
      assert.ok(Array.isArray(result.data.today_appointments));
      assert.ok(Array.isArray(result.data.due_reviews));
    }
    denied(await adminB.rpc("aura_care_dashboard", { p_org: fixture.oa }));
    denied(await unassigned.rpc("aura_care_dashboard", { p_org: fixture.oa }));
    const anon = createClient(url!, key!, {
      auth: { persistSession: false },
      global: { fetch: boundedFetch },
    });
    denied(await anon.rpc("aura_care_dashboard", { p_org: fixture.oa }));
    console.log(
      "PASS: real JWT/PostgREST follow-up, optimistic races, appointment concurrency, coach/tenant restrictions, archive/closure and private audit.",
    );
  } finally {
    let failed = false;
    for (const [org, ids] of [
      [fixture.oa, own.map((c) => c.id)],
      [fixture.ob, [foreign.id]],
    ] as [string, string[]][]) {
      const r = await admin
        .from("clients")
        .delete()
        .eq("organization_id", org)
        .in("id", ids);
      if (r.error) failed = true;
      const remaining = await admin
        .from("clients")
        .select("id")
        .eq("organization_id", org)
        .in("id", ids);
      if (remaining.error || remaining.data?.length) failed = true;
    }
    for (const session of sessions) {
      if ((await session.auth.signOut()).error) failed = true;
    }
    if (failed)
      throw new Error("Scoped synthetic cleanup or session logout failed.");
    console.log(
      "PASS: three generated students and cascaded follow-up/agenda/events removed; existing demo data untouched.",
    );
  }
}
void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Care integration failed",
  );
  process.exitCode = 1;
});
