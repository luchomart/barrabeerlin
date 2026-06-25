import { expect, test } from "@playwright/test";

import { mockAppServices } from "./support/mockApp.js";

function filaProducto(page, productoId) {
  return page.locator(`.producto-fila:has(input[data-id="${productoId}"])`);
}

test("stock smoke: Camara muestra barriles y otros sectores no", async ({ page }) => {
  await mockAppServices(page);
  await page.goto("/");

  await expect(page.locator("#select-empleado")).toBeVisible();
  await page.selectOption("#select-empleado", { label: "Karen" });
  await page.selectOption("#select-sector", { label: "Camara" });

  await expect(page.locator(".categoria-bloque", { hasText: "Barriles (sin pinchar)" })).toHaveCount(1);
  await page
    .locator(".categoria-titulo", { hasText: "Barriles (sin pinchar)" })
    .click();

  await expect(filaProducto(page, 101)).toBeVisible();
  await expect(filaProducto(page, 108)).toBeVisible();
  await expect(page.locator('input[data-id="101"]')).toHaveValue("4");
  await expect(page.locator('input[data-id="108"]')).toHaveValue("2");

  await page.selectOption("#select-sector", { label: "Estantes Barra" });

  await expect(page.locator(".categoria-bloque", { hasText: "Barriles (sin pinchar)" })).toHaveCount(0);
  await expect(page.locator(".producto-fila", { hasText: "Coca Cola" })).toHaveCount(1);
});

test("stock smoke: buscador sigue funcionando sobre el render actual", async ({ page }) => {
  await mockAppServices(page);
  await page.goto("/");

  await page.selectOption("#select-empleado", { label: "Karen" });
  await page.selectOption("#select-sector", { label: "Camara" });

  await page.fill("#buscar-producto", "ipa");

  await expect(filaProducto(page, 101)).toBeVisible();
  await expect(filaProducto(page, 108)).toBeVisible();
  await expect(page.locator(".categoria-bloque", { hasText: "Barriles (sin pinchar)" })).toHaveCount(1);
});

test("stock smoke: guardar normaliza cantidades y resetea sector", async ({ page }) => {
  await mockAppServices(page);
  await page.goto("/");

  await page.selectOption("#select-empleado", { label: "Karen" });
  await page.selectOption("#select-sector", { label: "Camara" });
  await page
    .locator(".categoria-titulo", { hasText: "Barriles (sin pinchar)" })
    .click();

  await page.locator('input[data-id="101"]').fill("9999");

  page.once("dialog", async (dialog) => {
    await expect(dialog.message()).toContain("Conteo guardado");
    await dialog.accept();
  });

  await page.click("#btn-guardar");

  const guardado = await page.evaluate(() => globalThis.__mockUltimoGuardado);
  const ipa = guardado.find((item) => String(item.producto_id) === "101");

  expect(Array.isArray(guardado)).toBe(true);
  expect(ipa.cantidad).toBe(1000);
  expect(ipa.sector_id).toBe("1");
  expect(ipa.empleado).toBe("Karen");
  expect(typeof ipa.ultima_actualizacion).toBe("string");

  await expect(page.locator("#select-sector")).toHaveValue("");
  await expect(page.locator("#lista-productos")).not.toBeVisible();
});

test("stock smoke: cancelar cambio de sector mantiene datos pendientes", async ({ page }) => {
  await mockAppServices(page);
  await page.goto("/");

  await page.selectOption("#select-empleado", { label: "Karen" });
  await page.selectOption("#select-sector", { label: "Camara" });
  await page
    .locator(".categoria-titulo", { hasText: "Barriles (sin pinchar)" })
    .click();

  await page.locator('input[data-id="101"]').fill("7");

  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.dismiss();
  });

  await page.selectOption("#select-sector", { label: "Estantes Barra" });

  await expect(page.locator("#select-sector")).toHaveValue("1");
  await expect(page.locator('input[data-id="101"]')).toHaveValue("7");
  await expect(page.locator(".categoria-bloque", { hasText: "Barriles (sin pinchar)" })).toHaveCount(1);
});

test("stock smoke: WhatsApp genera snapshot y abre URL mockeada", async ({ page }) => {
  await mockAppServices(page);
  await page.addInitScript(() => {
    globalThis.__openedUrls = [];
    globalThis.open = (url) => {
      globalThis.__openedUrls.push(url);
      return null;
    };
  });

  await page.goto("/");

  await page.selectOption("#select-empleado", { label: "Karen" });
  await page.selectOption("#select-sector", { label: "Camara" });
  await page.click("#btn-wpp-stock");

  const openedUrls = await page.evaluate(() => globalThis.__openedUrls);
  const ultimoSnapshot = await page.evaluate(() => globalThis.__mockUltimoSnapshot);

  expect(openedUrls).toHaveLength(1);
  expect(openedUrls[0]).toContain("https://api.whatsapp.com/send?text=");
  expect(openedUrls[0]).toContain("STOCK%20TOTAL%20BARRA");
  expect(ultimoSnapshot).toBeTruthy();
  expect(ultimoSnapshot.stockPorProducto).toBeTruthy();
});

test("supervisor smoke: carga resumen y cambios globales", async ({ page }) => {
  await mockAppServices(page, { authenticatedSupervisor: true });
  await page.goto("/supervisor.html");

  await expect(page.locator("#estado-sectores")).toContainText("Contados");
  await expect(page.locator("#estado-sectores")).toContainText("Pendientes");
  await expect(page.locator("#estado-sectores")).toContainText("Camara");
  await expect(page.locator("#estado-sectores")).toContainText("Deposito Cocina");

  await expect(page.locator("#lista-conteos")).toContainText("Karen");
  await expect(page.locator("#lista-conteos")).toContainText("Camara");

  await expect(page.locator("#lista-cambios-stock")).toContainText("Salida total");
  await expect(page.locator("#lista-cambios-stock")).toContainText("Entrada total");
  await expect(page.locator("#lista-cambios-stock")).toContainText("SALIDAS");
  await expect(page.locator("#lista-cambios-stock")).toContainText("ENTRADAS");
  await expect(page.locator("#lista-cambios-stock")).toContainText("SIN CAMBIOS");

  await page.click("#btn-recargar");

  await expect(page.locator("#lista-cambios-stock")).toContainText("IPA: -6");
  await expect(page.locator("#lista-cambios-stock")).toContainText("Coca Cola: +4");
});

test("supervisor smoke: acceso directo sin sesion muestra login y bloquea contenido", async ({ page }) => {
  await mockAppServices(page);
  await page.goto("/supervisor.html");

  await expect(page.locator("#supervisor-auth-shell")).toContainText("Ingresar al panel");
  await expect(page.locator("#btn-recargar")).toBeHidden();
  await expect(page.locator("#btn-whatsapp")).toBeHidden();
  await expect(page.locator("#estado-sectores")).toBeHidden();
});

test("stock smoke: copiar usa clipboard mockeado sin tocar datos reales", async ({ page }) => {
  await mockAppServices(page);
  await page.addInitScript(() => {
    globalThis.__copiedTexts = [];
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          globalThis.__copiedTexts.push(text);
        },
      },
    });
  });

  await page.goto("/");

  await page.selectOption("#select-empleado", { label: "Karen" });
  await page.selectOption("#select-sector", { label: "Camara" });

  page.once("dialog", async (dialog) => {
    await expect(dialog.message()).toContain("Copiado al portapapeles");
    await dialog.accept();
  });

  await page.click("#btn-copiar-stock");

  const copiedTexts = await page.evaluate(() => globalThis.__copiedTexts);

  expect(copiedTexts).toHaveLength(1);
  expect(copiedTexts[0]).toContain("STOCK TOTAL BARRA");
  expect(copiedTexts[0]).toContain("IPA: 4");
});

test("stock smoke: acceso oculto abre supervisor protegido y permite login", async ({ page }) => {
  await mockAppServices(page);
  await page.goto("/");

  for (let i = 0; i < 5; i += 1) {
    await page.click("#titulo-app");
  }

  await expect(page).toHaveURL(/supervisor\.html$/);
  await expect(page.locator("#supervisor-auth-shell")).toContainText("Ingresar al panel");

  await page.fill("#supervisor-login-email", "supervisor@beerlin.online");
  await page.fill("#supervisor-login-password", "1234");
  await page.click("#supervisor-login-submit");

  await expect(page.locator("#estado-sectores")).toContainText("Contados");
});

test("supervisor smoke: cerrar sesion vuelve a bloquear el panel", async ({ page }) => {
  await mockAppServices(page, { authenticatedSupervisor: true });
  await page.goto("/supervisor.html");

  await expect(page.locator("#estado-sectores")).toContainText("Contados");
  await page.click("#btn-cerrar-sesion-supervisor");

  await expect(page.locator("#supervisor-auth-shell")).toContainText("Ingresar al panel");
  await expect(page.locator("#btn-recargar")).toBeHidden();
  await expect(page.locator("#estado-sectores")).toBeHidden();
});

test("stock smoke: error de catalogo muestra fallback de carga", async ({ page }) => {
  await mockAppServices(page, { failProductos: true });
  await page.goto("/");

  await expect(page.locator("#lista-productos")).toContainText(
    "Error cargando la aplicacion",
  );
});

test("supervisor smoke: errores de servicios muestran fallbacks visuales", async ({ page }) => {
  await mockAppServices(page, {
    authenticatedSupervisor: true,
    failCambios: true,
    failConteos: true,
    failSectores: true,
  });
  await page.goto("/supervisor.html");

  await expect(page.locator("#lista-conteos")).toContainText(
    "Error cargando conteos",
  );
  await expect(page.locator("#estado-sectores")).toContainText(
    "Error cargando sectores",
  );
  await expect(page.locator("#lista-cambios-stock")).toContainText(
    "Error cargando cambios",
  );
});
