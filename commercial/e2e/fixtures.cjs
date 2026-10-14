const { expect } = require("@playwright/test");
const A = "00000000-0000-0000-0000-000000000010",
  B = "00000000-0000-0000-0000-000000000020";
const C = "00000000-0000-0000-0000-000000000100",
  U = "00000000-0000-0000-0000-000000000001";
const dateParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Lisbon', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;

// Browser contract tests only. All Supabase requests are intercepted; RLS is tested in PostgreSQL.
async function fixture(
  page,
  {
    role = "owner",
    dashboardError = false,
    slowA = false,
    archived = false,
    followupConflict = false,
    slotConflict = false,
    seedAppointments = 0,
    restricted = false,
    readOnly = false,
  } = {},
) {
  let failures = dashboardError ? 1 : 0,
    calls = 0,
    revocations = 0,
    followup = null,
    careEvents = [],
    followupConflicts = followupConflict ? 1 : 0,
    slotConflicts = slotConflict ? 1 : 0;
  const second = "00000000-0000-0000-0000-000000000005";
  let appointments = Array.from({ length: seedAppointments }, (_, i) => {
    const start = new Date(today + "T09:00:00Z");
    start.setMinutes(start.getMinutes() + i * 15);
    return {
      id: `00000000-0000-0000-0000-${String(500 + i).padStart(12, "0")}`,
      organization_id: A,
      client_id: C,
      professional_id: U,
      kind: "session",
      status: "scheduled",
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + 15 * 60000).toISOString(),
      revision: 1,
      clients: { full_name: "Aluno Fictício A", archived_at: null },
    };
  });
  const user = {
    id: U,
    aud: "authenticated",
    role: "authenticated",
    email: "fictional@example.invalid",
    email_confirmed_at: today,
    app_metadata: { provider: "email" },
    user_metadata: {},
    created_at: today,
  };
  const jwt = [
    { alg: "HS256", typ: "JWT" },
    {
      sub: U,
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    "fixture",
  ]
    .map((v) =>
      Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString(
        "base64url",
      ),
    )
    .join(".");
  const client = {
    id: C,
    organization_id: A,
    full_name: "Aluno Fictício A",
    created_at: today,
    updated_at: today,
    archived_at: archived ? today : null,
    revision: 1,
  };
  const assessments = [
    {
      id: "measurement-1",
      revision: 1, student_visible: false, superseded_at: null,
      assessed_on: today,
      weight_kg: 80,
      height_cm: 175,
      waist_cm: null,
    },
  ];
  await page.route("https://*.supabase.co/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname;
    const respond = (body, status = 200, extra = {}) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-expose-headers": "content-range",
          ...extra,
        },
        body: JSON.stringify(body),
      });
    if (request.method() === "OPTIONS") return respond({});
    if (path.endsWith("/auth/v1/token"))
      return respond({
        access_token: jwt,
        refresh_token: "fixture-refresh",
        token_type: "bearer",
        expires_in: 3600,
        user,
      });
    if (path.endsWith("/auth/v1/user")) return respond(user);
    if (path.endsWith("/auth/v1/logout")) return respond({});
    if (path.endsWith("/organization_members"))
      return respond([
        { role, organizations: { id: A, name: "Estúdio Fictício A" } },
        { role: "owner", organizations: { id: B, name: "Estúdio Fictício B" } },
      ]);
    if (path.endsWith("/organization_branding"))
      return respond({
        display_name:
          url.searchParams.get("organization_id") === "eq." + B
            ? "Marca B"
            : "Marca A",
        primary_color: "#137F79",
        logo_url: null,
      });
    if (
      path.endsWith("/rpc/aura_dashboard") ||
      path.endsWith("/rpc/aura_care_dashboard")
    ) {
      calls++;
      const org = request.postDataJSON().p_org;
      if (failures-- > 0)
        return respond({ message: "fixture error", code: "XX000" }, 500);
      if (slowA && org === A)
        await new Promise((resolve) => setTimeout(resolve, 700));
      return respond({
        as_of: today,
        active_clients: org === A ? 7 : 2,
        archived_clients: 1,
        assessments_30_days: 3,
        pending_clients: 1,
        pending: [
          {
            id: C,
            full_name: org === A ? "Aluno Fictício A" : "Aluno Fictício B",
            assessed_on: null,
          },
        ],
        recent: [],
        reviews_due: followup?.next_review ? 1 : 0,
        appointments_today: appointments.filter(
          (a) => a.status === "scheduled" && a.starts_at.slice(0, 10) === today,
        ).length,
        due_reviews: followup?.next_review
          ? [
              {
                id: C,
                full_name: "Aluno Fictício A",
                next_review: followup.next_review,
              },
            ]
          : [],
        today_appointments: appointments
          .filter(
            (a) =>
              a.status === "scheduled" && a.starts_at.slice(0, 10) === today,
          )
          .map((a) => ({ ...a, full_name: client.full_name })),
      });
    }
    if(path.endsWith('/rpc/aura_client_permissions'))return respond({assessments_read:!restricted,assessments_write:!restricted&&!readOnly,followup_read:!restricted,followup_write:!restricted&&!readOnly,schedule_read:true,schedule_write:!readOnly});
    if(path.endsWith('/rpc/aura_privacy_context'))return respond({consents:[],requests:[]});
    if(path.endsWith('/staff_capabilities')||path.endsWith('/client_assignments')||path.endsWith('/client_users'))return respond([]);
    if(path.endsWith('/rpc/aura_assessment_create')){const p=request.postDataJSON();assessments.unshift({id:'new-synthetic-measurement',assessed_on:p.p_date,weight_kg:p.p_weight,height_cm:p.p_height,waist_cm:p.p_waist,revision:1,student_visible:false,superseded_at:null});return respond('new-synthetic-measurement');}
    if(path.endsWith('/rpc/aura_assessment_share')){const input=request.postDataJSON();const a=assessments.find(a=>a.id===input.p_assessment);a.student_visible=input.p_visible;a.revision++;return respond(a.revision);}
    if(path.endsWith('/rpc/aura_visible_export'))return respond({format_version:1,scope:'visible_records_only',client:{id:C},assessments:[]});
    if (path.endsWith("/rpc/aura_team_list"))
      return respond([
        { user_id: U, email: user.email, role: "owner", joined_at: today },
      ]);
    if (path.endsWith("/rpc/aura_invitation_list"))
      return respond([
        {
          id: "00000000-0000-0000-0000-000000000300",
          email: "invite@example.invalid",
          role: "coach",
          status: revocations ? "revoked" : "pending",
          expires_at: today,
        },
      ]);
    if (path.endsWith("/rpc/aura_invitation_revoke")) {
      revocations++;
      return respond(null);
    }
    if (path.endsWith("/rpc/aura_professional_choices"))
      return respond([
        { user_id: U, display_name: "Profissional Fictício", role },
        {
          user_id: second,
          display_name: "Profissional Segundo",
          role: "coach",
        },
      ]);
    if (path.endsWith("/client_followups"))
      return respond(followup ? [followup] : []);
    if (path.endsWith("/rpc/aura_care_history")) {
      const offset = request.postDataJSON().p_offset;
      return respond(careEvents.slice(offset, offset + 25));
    }
    if (path.endsWith("/rpc/aura_followup_save")) {
      if (followupConflicts-- > 0)
        return respond({ code: "PT409", message: "Revision conflict" }, 409);
      const input = request.postDataJSON();
      followup = {
        goal: input.p_goal,
        status: input.p_status,
        responsible_id: input.p_responsible,
        next_review: input.p_review,
        revision: (followup?.revision || 0) + 1,
      };
      careEvents.unshift({
        id: "event-" + careEvents.length,
        actor_id: U,
        action: "followup_updated",
        revision: followup.revision,
        created_at: new Date().toISOString(),
        from_status: null,
        to_status: followup.status,
      });
      return respond(followup.revision);
    }
    if (path.endsWith("/appointments")) {
      let rows = appointments.filter(
        (a) =>
          a.organization_id ===
          url.searchParams.get("organization_id")?.slice(3),
      );
      for (const key of ["client_id", "professional_id", "status"]) {
        const value = url.searchParams.get(key);
        if (value) rows = rows.filter((a) => a[key] === value.slice(3));
      }
      const bounds = url.searchParams.getAll("starts_at");
      for (const value of bounds) {
        if (value.startsWith("gte."))
          rows = rows.filter(
            (a) => Date.parse(a.starts_at) >= Date.parse(value.slice(4)),
          );
        if (value.startsWith("lt."))
          rows = rows.filter(
            (a) => Date.parse(a.starts_at) < Date.parse(value.slice(3)),
          );
      }
      rows.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      const total = rows.length,
        offset = Number(url.searchParams.get("offset") || 0),
        limit = Number(url.searchParams.get("limit") || 25);
      rows = rows.slice(offset, offset + limit);
      return respond(rows, 200, {
        "content-range": rows.length
          ? `${offset}-${offset + rows.length - 1}/${total}`
          : `*/${total}`,
      });
    }
    if (path.endsWith("/rpc/aura_appointment_save")) {
      if (slotConflicts-- > 0)
        return respond({ code: "PT409", message: "Slot unavailable" }, 409);
      const input = request.postDataJSON(),
        old = appointments.find((a) => a.id === input.p_id);
      const record = {
        id:
          old?.id ||
          `00000000-0000-0000-0000-${String(900 + appointments.length).padStart(12, "0")}`,
        organization_id: input.p_org,
        client_id: input.p_client,
        professional_id: input.p_professional,
        kind: input.p_kind,
        status: input.p_status,
        starts_at: input.p_start,
        ends_at: input.p_end,
        revision: (old?.revision || 0) + 1,
        clients: {
          full_name: client.full_name,
          archived_at: client.archived_at,
        },
      };
      appointments = appointments.filter((a) => a.id !== record.id);
      appointments.push(record);
      return respond(record.id);
    }
    if (path.endsWith("/clients")) {
      const matches =
        (!url.searchParams.get("id") ||
          url.searchParams.get("id") === "eq." + C) &&
        url.searchParams.get("organization_id") === "eq." + A;
      const rows = matches ? [client] : [];
      if (request.headers().accept?.includes("vnd.pgrst.object"))
        return respond(rows[0] || null);
      return respond(rows, 200, {
        "content-range": rows.length ? "0-0/1" : "*/0",
      });
    }
    if (path.endsWith("/assessments")) {
      if (request.method() === "POST") {
        const input = request.postDataJSON();
        assessments.unshift({
          id: "measurement-2",
          assessed_on: input.assessed_on,
          weight_kg: input.weight_kg,
          height_cm: input.height_cm,
          waist_cm: input.waist_cm,
        });
        return respond(null, 201);
      }
      return respond(assessments, 200, {
        "content-range": `0-${assessments.length - 1}/${assessments.length}`,
      });
    }
    // Deny unimplemented endpoints instead of making accidental cloud requests.
    return respond(
      { message: "Fixture endpoint unavailable", code: "42501" },
      403,
    );
  });
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Palavra-passe").fill("Fictional-password-only");
  await page.getByRole("button", { name: "Entrar na plataforma" }).click();
  await expect(
    page.getByRole("combobox", { name: /^Estabelecimento/ }),
  ).toHaveValue(A);
  return {
    calls: () => calls,
    revocations: () => revocations,
    followup: () => followup,
    appointments: () => appointments,
    second,
  };
}

module.exports = { fixture, A, B, C, U, today };
