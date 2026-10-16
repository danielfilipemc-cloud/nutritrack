const { test, expect } = require("@playwright/test");
const { fixture, A, B, C, today } = require("./fixtures.cjs");
async function profile(page) {
  await page.goto(`/alunos/${C}?org=${A}`);
  await expect(page.getByLabel("Objetivo do acompanhamento")).toBeEnabled();
}

test("profile saves goal, responsible and review, then shows them on the dashboard", async ({
  page,
}) => {
  const state = await fixture(page);
  await profile(page);
  await page
    .getByLabel("Objetivo do acompanhamento")
    .fill("Melhorar consistência do treino fictício");
  await page.getByLabel("Profissional responsável").selectOption(state.second);
  await page.getByLabel("Próxima revisão").fill(today);
  await page
    .getByRole("button", { name: "Guardar acompanhamento", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Acompanhamento guardado" }),
  ).toBeVisible();
  expect(state.followup().responsible_id).toBe(state.second);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Prioridades de hoje" }),
  ).toBeVisible();
  await expect(page.getByText("Revisão pendente · " + today)).toBeVisible();
  await profile(page);
  await expect(page.getByLabel("Objetivo do acompanhamento")).toHaveValue(
    "Melhorar consistência do treino fictício",
  );
  await expect(
    page.getByText("Acompanhamento atualizado", { exact: true }),
  ).toBeVisible();
});

test("conflicting profile write keeps draft and requires explicit reload", async ({
  page,
}) => {
  await fixture(page, { followupConflict: true });
  await profile(page);
  await page
    .getByLabel("Objetivo do acompanhamento")
    .fill("Não perder este rascunho");
  await page
    .getByRole("button", { name: "Guardar acompanhamento", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "alterações foram mantidas" }),
  ).toBeVisible();
  await expect(page.getByLabel("Objetivo do acompanhamento")).toHaveValue(
    "Não perder este rascunho",
  );
  await expect(
    page.getByRole("button", { name: "Guardar acompanhamento", exact: true }),
  ).toBeDisabled();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Recarregar ficha" }).click();
  await expect(page.getByLabel("Objetivo do acompanhamento")).toHaveValue(
    "Não perder este rascunho",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Recarregar ficha" }).click();
  await expect(page.getByLabel("Objetivo do acompanhamento")).toHaveValue("");
});

test("coach edits follow-up but cannot assign responsible; archived profile is read-only", async ({
  page,
}) => {
  await fixture(page, { role: "coach" });
  await profile(page);
  await expect(page.getByLabel("Profissional responsável")).toBeDisabled();
  await expect(page.getByLabel("Objetivo do acompanhamento")).toBeEnabled();
});
test("archived overview disables follow-up and hides appointment creation", async ({
  page,
}) => {
  await fixture(page, { archived: true });
  await page.goto(`/alunos/${C}?org=${A}`);
  await expect(page.getByLabel("Objetivo do acompanhamento")).toBeDisabled();
  await page.getByRole("button", { name: "Agenda do aluno" }).click();
  await expect(
    page.getByRole("button", { name: "Guardar marcação", exact: true }),
  ).toHaveCount(0);
});

test("student agenda handles slot conflict, cancellation confirmation and reopening", async ({
  page,
}) => {
  const state = await fixture(page, { slotConflict: true });
  await profile(page);
  await page.getByRole("button", { name: "Agenda do aluno" }).click();
  await page
    .getByLabel("Data e hora (Lisboa)", { exact: true })
    .fill(today + "T10:00");
  await page
    .getByRole("button", { name: "Guardar marcação", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "já tem uma marcação" }),
  ).toBeVisible();
  expect(state.appointments()).toHaveLength(0);
  await page
    .getByLabel("Data e hora (Lisboa)", { exact: true })
    .fill(today + "T11:00");
  await page
    .getByRole("button", { name: "Guardar marcação", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Marcação guardada" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancelar marcação", exact: true }),
  ).toBeEnabled();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Cancelar marcação", exact: true })
    .click();
  expect(state.appointments()[0].status).toBe("scheduled");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Cancelar marcação", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Marcação atualizada" }),
  ).toBeVisible();
  expect(state.appointments()[0].status).toBe("cancelled");
  await page.getByLabel("Estado das marcações").selectOption("cancelled");
  await page.getByRole("button", { name: "Reagendar", exact: true }).click();
  await page
    .getByLabel("Data e hora (Lisboa)", { exact: true })
    .fill(today + "T12:00");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Guardar alterações da marcação" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Marcação guardada" }),
  ).toBeVisible();
  expect(state.appointments()[0].status).toBe("scheduled");
});

test("agenda paginates and retains establishment across navigation", async ({
  page,
}) => {
  await fixture(page, { seedAppointments: 27 });
  await page.goto("/agenda");
  await expect(page.locator(".aura-appointment-list>li")).toHaveCount(25);
  await page
    .getByRole("navigation", { name: "Paginação da agenda" })
    .getByRole("button", { name: "Seguinte", exact: true })
    .click();
  await expect(page.locator(".aura-appointment-list>li")).toHaveCount(2);
  await page
    .getByRole("combobox", { name: /^Estabelecimento/ })
    .selectOption(B);
  await expect(page.locator(".aura-appointment-list>li")).toHaveCount(0);
  await page.goto("/alunos");
  await expect(
    page.getByRole("combobox", { name: /^Estabelecimento/ }),
  ).toHaveValue(B);
  await page.goto("/agenda?org=" + A);
  await expect(
    page.getByRole("combobox", { name: /^Estabelecimento/ }),
  ).toHaveValue(A);
});

test("agenda rejects Lisbon repeated hour and remains usable on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await fixture(page);
  await profile(page);
  await page.getByRole("button", { name: "Agenda do aluno" }).click();
  await page
    .getByLabel("Data e hora (Lisboa)", { exact: true })
    .fill("2026-10-25T01:30");
  await page
    .getByRole("button", { name: "Guardar marcação", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "ambígua" }),
  ).toBeVisible();
  const size = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(size.width).toBeLessThanOrEqual(size.viewport + 2);
});
