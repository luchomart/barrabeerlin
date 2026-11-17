import { expect, test } from "@playwright/test";

import { mockAppServices } from "./support/mockApp.js";

// Acepta todos los alert/confirm y devuelve sus mensajes.
function aceptarDialogos(page) {
  const mensajes = [];

  page.on("dialog", async (dialog) => {
    mensajes.push(dialog.message());
    await dialog.accept();
  });

  return mensajes;
}

// Toca Guardar y, si avisa que hay categorias sin abrir, confirma "Guardar igual".
async function guardarConteo(page) {
  await page.click("#btn-guardar");

  const guardarIgual = page.locator('#aviso-guardar [data-accion="guardar-igual"]');

  if (await guardarIgual.isVisible()) {
    await guardarIgual.click();
  }
}

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

test("stock smoke: elegir el sector antes que el empleado igual carga los productos", async ({ page }) => {
  await mockAppServices(page);
  await page.goto("/");

  await page.selectOption("#select-sector", { label: "Camara" });
  await page.selectOption("#select-empleado", { label: "Karen" });

  await expect(page.locator(".categoria-bloque", { hasText: "Barriles (sin pinchar)" })).toHaveCount(1);
  await expect(page.locator('input[data-id="101"]')).toHaveValue("4");

  // Cambiar de empleado con el sector cargado no borra lo que se estaba contando.
  await page
    .locator(".categoria-titulo", { hasText: "Barriles (sin pinchar)" })
    .click();
  await page.locator('input[data-id="101"]').fill("7");
  await page.selectOption("#select-empleado", { label: "Luciano" });
  await expect(page.locator('input[data-id="101"]')).toHaveValue("7");
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

test("stock smoke: el buscador ignora tildes y mayusculas", async ({ page }) => {
  await mockAppServices(page);
  await page.addInitScript(() => {
    globalThis.__mockCatalogo = {
      productos: [{ id: 901, nombre: "Levité Pomelo", categoria_id: 3, orden: 1 }],
      categorias: [{ id: 3, nombre: "Aguas" }],
      empleados: [{ id: 1, nombre: "Karen" }],
    };
  });
  await page.goto("/");

  await page.selectOption("#select-empleado", { label: "Karen" });
  await page.selectOption("#select-sector", { label: "Estantes Barra" });

  await page.fill("#buscar-producto", "LEVITE");
  await expect(filaProducto(page, 901)).toBeVisible();
  await expect(page.locator(".busqueda-vacia")).toHaveCount(0);
});

test("stock smoke: buscar lleva el resultado arriba y en el celu oculta el pie al escribir", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 500 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await mockAppServices(page);
  await page.goto("/");

  await page.selectOption("#select-empleado", { label: "Karen" });
  await page.selectOption("#select-sector", { label: "Estantes Barra" });

  await page.locator("#buscar-producto").focus();
  await expect(page.locator("footer")).toBeHidden();

  await page.locator("#buscar-producto").fill("coca");

  // El resultado queda visible justo debajo del buscador fijo.
  const fila = filaProducto(page, 201);
  await expect(fila).toBeInViewport();
  const buscador = await page.locator(".busqueda").boundingBox();
  const bloque = await page.locator(".categoria-bloque", { has: fila }).boundingBox();
  expect(buscador.y).toBeLessThan(5);
  expect(bloque.y).toBeGreaterThanOrEqual(buscador.y + buscador.height - 1);
  expect(bloque.y).toBeLessThan(buscador.y + buscador.height + 40);

  // Al salir del campo vuelve el pie.
  await page.locator("#buscar-producto").blur();
  await expect(page.locator("footer")).toBeVisible();

  await context.close();
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

  await guardarConteo(page);
  await expect(page.locator("#comprobante-conteo")).toContainText("Camara guardado");
  await expect(page.locator("#comprobante-conteo")).toContainText("Karen");

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

test("stock smoke: cambiar de sector conserva lo contado como borrador", async ({ page }) => {
  await mockAppServices(page);
  await page.goto("/");

  await page.selectOption("#select-empleado", { label: "Karen" });
  await page.selectOption("#select-sector", { label: "Camara" });
  await page
    .locator(".categoria-titulo", { hasText: "Barriles (sin pinchar)" })
    .click();

  await page.locator('input[data-id="101"]').fill("7");

  await page.selectOption("#select-sector", { label: "Estantes Barra" });
  await expect(page.locator("#aviso-stock")).toContainText("Camara quedó guardado como borrador");

  await page.selectOption("#select-sector", { label: "Camara" });
  await expect(page.locator('input[data-id="101"]')).toHaveValue("7");
  await expect(page.locator('input[data-id="101"]')).toHaveClass(/input-modificado/);
  await expect(page.locator("#aviso-stock")).toContainText("Se recuperó el conteo sin guardar de Camara");
});

test("stock smoke: progreso por categoria y aviso antes de guardar sin revisar todo", async ({ page }) => {
  await mockAppServices(page);
  await page.goto("/");

  await page.selectOption("#select-empleado", { label: "Karen" });
  await page.selectOption("#select-sector", { label: "Estantes Barra" });

  const progreso = page.locator("#progreso-conteo");
  const total = await page.locator(".categoria-bloque").count();

  await expect(progreso).toHaveText(`0 de ${total} categorías revisadas`);

  // Abrir una categoria la marca como revisada.
  const primera = page.locator(".categoria-bloque").first();
  await primera.locator(".categoria-titulo").click();
  await expect(primera.locator(".categoria-estado")).toBeVisible();
  await expect(progreso).toHaveText(`1 de ${total} categorías revisadas`);

  // Guardar con categorias sin abrir avisa y no guarda todavia.
  await page.click("#btn-guardar");
  await expect(page.locator("#aviso-guardar")).toContainText("Se guardan con la cantidad que ya tenían");
  expect(await page.evaluate(() => globalThis.__mockUltimoGuardado)).toBeUndefined();

  // "Revisar" abre la siguiente sin revisar.
  await page.click('#aviso-guardar [data-accion="revisar"]');
  await expect(page.locator("#aviso-guardar")).toBeHidden();
  await expect(progreso).toHaveText(
    total === 2 ? `Revisaste las ${total} categorías` : `2 de ${total} categorías revisadas`,
  );

  await guardarConteo(page);
  await expect(page.locator("#comprobante-conteo")).toContainText("Estantes Barra guardado");
  expect(Array.isArray(await page.evaluate(() => globalThis.__mockUltimoGuardado))).toBe(true);
});

test("stock smoke: los botones − y + cambian la cantidad sin teclado", async ({ page }) => {
  await mockAppServices(page);
  await page.goto("/");

  await page.selectOption("#select-empleado", { label: "Karen" });
  await page.selectOption("#select-sector", { label: "Camara" });
  await page
    .locator(".categoria-titulo", { hasText: "Barriles (sin pinchar)" })
    .click();

  const fila = filaProducto(page, 101);
  const input = page.locator('input[data-id="101"]');

  await expect(input).toHaveValue("4");
  await fila.locator('[data-paso="1"]').click();
  await fila.locator('[data-paso="1"]').click();
  await expect(input).toHaveValue("6");
  await expect(input).toHaveClass(/input-modificado/);

  await fila.locator('[data-paso="-1"]').click();
  await expect(input).toHaveValue("5");
  await expect(input).toHaveAttribute("aria-label", "Cantidad de IPA");
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

test("supervisor smoke: Enviar stock manda el mismo mensaje con emojis sanos", async ({ page }) => {
  await mockAppServices(page, { authenticatedSupervisor: true });
  await page.addInitScript(() => {
    globalThis.__openedUrls = [];
    globalThis.open = (url) => {
      globalThis.__openedUrls.push(url);
      return null;
    };
  });
  await page.goto("/supervisor.html");
  await expect(page.locator("#estado-sectores")).toContainText("Contados");

  await page.click("#btn-whatsapp");
  await expect.poll(() => page.evaluate(() => globalThis.__openedUrls.length)).toBe(1);

  const url = await page.evaluate(() => globalThis.__openedUrls[0]);
  // wa.me redirige y cambia los emojis por "?": hay que usar api.whatsapp.com.
  expect(url.startsWith("https://api.whatsapp.com/send?text=")).toBe(true);

  const texto = decodeURIComponent(url.split("text=")[1]);
  expect(texto.startsWith("\u{1F4CA} *STOCK TOTAL BARRA*")).toBe(true);
  expect(texto).toContain("*BARRILES (SIN PINCHAR)*");
  expect(texto).not.toContain("\uFFFD");
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
  // Con otro sector elegido, el stock total igual trae los barriles.
  await page.selectOption("#select-sector", { label: "Estantes Barra" });

  await page.click("#btn-copiar-stock");
  await expect(page.locator("#btn-copiar-stock")).toHaveText("Copiado");

  const copiedTexts = await page.evaluate(() => globalThis.__copiedTexts);

  expect(copiedTexts).toHaveLength(1);
  expect(copiedTexts[0]).toContain("STOCK TOTAL BARRA");
  expect(copiedTexts[0]).toContain("*BARRILES (SIN PINCHAR)*");
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

  await expect(page.locator("#lista-productos")).toContainText("No se pudo cargar la app");
  await expect(page.locator("#btn-reintentar-carga")).toBeVisible();
  await expect(page.locator("#btn-guardar")).toBeDisabled();
  await expect(page.locator("#estado-conexion")).toHaveAttribute("data-estado", "error");
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

test("stock smoke: el desplegable de empleados sale de Supabase e ignora un empleado borrado", async ({ page }) => {
  await mockAppServices(page);
  await page.addInitScript(() => {
    localStorage.setItem("empleado", "Empleado Borrado");
  });
  await page.goto("/");

  await expect(page.locator("#select-empleado option")).toHaveText([
    "Elegí…",
    "Karen",
    "Eve",
    "Nicolas",
    "Luciano",
    "Fiorella",
  ]);
  await expect(page.locator("#select-empleado")).toHaveValue("");
});

test("stock smoke: si fallan los empleados se usa la ultima lista guardada y se puede contar", async ({ page }) => {
  await mockAppServices(page, { failEmpleados: true });
  await page.addInitScript(() => {
    localStorage.setItem(
      "stock-empleados",
      JSON.stringify([{ id: 1, nombre: "Karen" }, { id: 2, nombre: "Eve" }]),
    );
    localStorage.setItem("empleado", "Nuevo");
  });
  await page.goto("/");

  await expect(page.locator("#select-empleado option")).toHaveText([
    "Elegí…",
    "Karen",
    "Eve",
    "Nuevo",
  ]);
  await expect(page.locator("#select-empleado")).toHaveValue("Nuevo");
  await expect(page.locator("#aviso-stock")).toContainText("lista de empleados");

  await page.selectOption("#select-sector", { label: "Camara" });
  await expect(page.locator(".categoria-bloque").first()).toBeVisible();
});

test("stock smoke: sin internet el conteo queda pendiente y se envia al volver la conexion", async ({ page }) => {
  await mockAppServices(page);
  await page.goto("/");

  await page.selectOption("#select-empleado", { label: "Karen" });
  await page.selectOption("#select-sector", { label: "Camara" });
  await page
    .locator(".categoria-titulo", { hasText: "Barriles (sin pinchar)" })
    .click();
  await page.locator('input[data-id="101"]').fill("6");

  await page.evaluate(() => {
    globalThis.__mockSinRed = true;
  });

  await guardarConteo(page);
  await expect(page.locator("#comprobante-conteo")).toContainText("Camara quedó guardado en este celular");

  await expect(page.locator("#aviso-stock")).toContainText("1 conteo sin enviar");
  await expect(page.locator("#estado-conexion")).toHaveText("1 sin enviar");
  await expect(page.locator("#select-sector")).toHaveValue("");

  // Vuelve internet: se envia solo.
  await page.evaluate(() => {
    globalThis.__mockSinRed = false;
    window.dispatchEvent(new Event("online"));
  });

  await expect(page.locator("#aviso-stock")).toContainText("Se envió el conteo pendiente de Camara");
  await expect(page.locator("#estado-conexion")).toHaveText("En línea");

  const guardado = await page.evaluate(() => globalThis.__mockUltimoGuardado);
  const ipa = guardado.find((item) => String(item.producto_id) === "101");
  expect(ipa.cantidad).toBe(6);
  expect(ipa.empleado).toBe("Karen");

  const pendientes = await page.evaluate(() => localStorage.getItem("stock-pendientes"));
  expect(pendientes).toBeNull();
});

test("stock smoke: un pendiente no pisa un conteo mas nuevo del mismo sector", async ({ page }) => {
  await mockAppServices(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem("preparado")) return;
    sessionStorage.setItem("preparado", "1");
    localStorage.setItem(
      "stock-pendientes",
      JSON.stringify([
        {
          id: "p1",
          sector_id: "1",
          sector_nombre: "Camara",
          empleado: "Karen",
          creado: "2026-11-17T10:00:00.000Z",
          registros: [{ producto_id: 101, sector_id: "1", cantidad: 3 }],
        },
      ]),
    );
    globalThis.__mockInventarioSector = {
      1: [{ producto_id: 101, cantidad: 9, ultima_actualizacion: "2026-11-17T11:00:00+00:00" }],
    };
  });

  const mensajes = aceptarDialogos(page);
  await page.goto("/");
  await expect.poll(() => mensajes.join("\n")).toContain("ya tiene un conteo más nuevo");

  expect(await page.evaluate(() => globalThis.__mockUltimoGuardado)).toBeUndefined();
  expect(await page.evaluate(() => localStorage.getItem("stock-pendientes"))).toBeNull();
});

test("stock smoke: lo tipeado se recupera si se recarga la pagina", async ({ page }) => {
  await mockAppServices(page);
  await page.goto("/");

  await page.selectOption("#select-empleado", { label: "Karen" });
  await page.selectOption("#select-sector", { label: "Camara" });
  await page
    .locator(".categoria-titulo", { hasText: "Barriles (sin pinchar)" })
    .click();
  await page.locator('input[data-id="101"]').fill("12");

  // Aunque el celu quede con otro empleado elegido, se retoma con quien lo contaba.
  await page.evaluate(() => localStorage.setItem("empleado", "Luciano"));
  await page.reload();

  await expect(page.locator("#select-sector")).toHaveValue("1");
  await expect(page.locator("#select-empleado")).toHaveValue("Karen");
  await expect(page.locator('input[data-id="101"]')).toHaveValue("12");
  await expect(page.locator('input[data-id="101"]')).toHaveClass(/input-modificado/);
  await expect(page.locator("#aviso-stock")).toContainText("Se recuperó el conteo sin guardar de Camara");

  // Guardar bien borra el borrador.
  await guardarConteo(page);
  await expect(page.locator("#select-sector")).toHaveValue("");
  expect(await page.evaluate(() => localStorage.getItem("stock-borradores"))).toBeNull();
});

test("stock smoke: si se cambia rapido de sector, la carga vieja no pisa al sector nuevo", async ({ page }) => {
  await mockAppServices(page);
  await page.addInitScript(() => {
    globalThis.__mockDemoraSector = { 1: 600 };
  });
  await page.goto("/");

  await page.selectOption("#select-empleado", { label: "Karen" });
  await page.selectOption("#select-sector", { label: "Camara" });
  await page.selectOption("#select-sector", { label: "Estantes Barra" });

  await page.waitForTimeout(900);

  await expect(page.locator("#select-sector")).not.toHaveValue("1");
  await expect(page.locator(".categoria-bloque", { hasText: "Barriles (sin pinchar)" })).toHaveCount(0);

  await guardarConteo(page);
  await expect(page.locator("#comprobante-conteo")).toContainText("Estantes Barra guardado");

  const guardado = await page.evaluate(() => globalThis.__mockUltimoGuardado);
  // El producto 201 tiene 6 en Camara y 8 en Estantes Barra.
  const fila201 = guardado.find((fila) => String(fila.producto_id) === "201");
  expect(fila201.sector_id).toBe("2");
  expect(fila201.cantidad).toBe(8);
});

test("supervisor smoke: admin agrega y elimina empleados, categorias y productos", async ({ page }) => {
  await mockAppServices(page, { authenticatedSupervisor: true });
  await page.goto("/supervisor.html");

  const admin = page.locator("#seccion-admin");
  const mensaje = page.locator("#admin-mensaje");

  await expect(admin).toBeHidden();
  await page.click("#btn-admin");
  await expect(admin).toBeVisible();
  await expect(page.locator("#btn-admin")).toHaveAttribute("aria-expanded", "true");

  // Empleados
  const bloqueEmpleados = admin.locator('[data-bloque="empleados"]');
  await bloqueEmpleados.locator('input[name="nombre"]').fill("Juan");
  await bloqueEmpleados.locator('button[type="submit"]').click();
  await expect(mensaje).toHaveText('Empleado "Juan" agregado.');
  await expect(bloqueEmpleados.locator(".admin-item")).toHaveCount(6);

  await bloqueEmpleados.locator('input[name="nombre"]').fill("karen");
  await bloqueEmpleados.locator('button[type="submit"]').click();
  await expect(mensaje).toContainText("Ya existe");
  await expect(mensaje).toHaveClass(/admin-mensaje-error/);

  page.once("dialog", (dialog) => dialog.accept());
  await bloqueEmpleados.locator('[data-accion="eliminar-empleado"][data-nombre="Juan"]').click();
  await expect(mensaje).toHaveText('Empleado "Juan" eliminado.');
  await expect(bloqueEmpleados.locator(".admin-item")).toHaveCount(5);

  // Categorias: con productos no se puede borrar; una nueva vacia si
  const bloqueCategorias = admin.locator('[data-bloque="categorias"]');
  await expect(
    bloqueCategorias.locator('[data-accion="eliminar-categoria"][data-nombre="Cervezas"]'),
  ).toBeDisabled();
  await bloqueCategorias.locator('input[name="nombre"]').fill("Sidras");
  await bloqueCategorias.locator('button[type="submit"]').click();
  await expect(mensaje).toHaveText('Categoría "Sidras" agregada.');

  // Productos
  const bloqueProductos = admin.locator('[data-bloque="productos"]');
  await bloqueProductos.locator('input[name="nombre"]').fill("Sidra Pera");
  await bloqueProductos.locator('select[name="categoria_id"]').selectOption({ label: "Sidras" });
  await bloqueProductos.locator('button[type="submit"]').click();
  await expect(mensaje).toHaveText('Producto "Sidra Pera" agregado.');
  await expect(
    bloqueCategorias.locator('[data-accion="eliminar-categoria"][data-nombre="Sidras"]'),
  ).toBeDisabled();

  // Borrar producto con stock: la confirmacion avisa unidades y sectores
  let textoConfirmacion = "";
  page.once("dialog", (dialog) => {
    textoConfirmacion = dialog.message();
    dialog.accept();
  });
  await bloqueProductos.locator("summary", { hasText: "Gaseosas" }).click();
  await bloqueProductos.locator('[data-accion="eliminar-producto"][data-nombre="Coca Cola"]').click();
  await expect(mensaje).toHaveText('Producto "Coca Cola" eliminado.');
  expect(textoConfirmacion).toContain("Tiene 8 unidad(es) en 1 sector(es).");
  expect(textoConfirmacion).toContain("historial de capturas");

  // Cancelar la confirmacion no borra nada
  page.once("dialog", (dialog) => dialog.dismiss());
  await bloqueProductos.locator("summary", { hasText: "Sidras" }).click();
  await bloqueProductos.locator('[data-accion="eliminar-producto"][data-nombre="Sidra Pera"]').click();
  await expect(
    bloqueProductos.locator('[data-accion="eliminar-producto"][data-nombre="Sidra Pera"]'),
  ).toHaveCount(1);

  // Mover un producto a otra categoria
  await bloqueProductos.locator("summary", { hasText: "Aguas" }).click();
  await bloqueProductos.locator('[data-accion="mover-producto"][data-nombre="Agua"]').click();
  const formMover = bloqueProductos.locator(".admin-form-mover");
  await expect(formMover).toHaveCount(1);
  await expect(formMover.locator("option", { hasText: "Aguas (actual)" })).toBeDisabled();

  // Cancelar cierra el selector sin llamar a nada
  await formMover.locator('[data-accion="cancelar-mover"]').click();
  await expect(formMover).toHaveCount(0);

  await bloqueProductos.locator('[data-accion="mover-producto"][data-nombre="Agua"]').click();
  await formMover.locator("select").selectOption({ label: "Gaseosas" });
  await formMover.locator('button[type="submit"]').click();
  await expect(mensaje).toHaveText('Producto "Agua" movido a Gaseosas.');
  await bloqueProductos.locator("summary", { hasText: "Gaseosas" }).click();
  await expect(
    bloqueProductos.locator('details[data-categoria="2"] [data-nombre="Agua"]').first(),
  ).toBeVisible();

  // No avisar si esta en 0
  const bloqueSinAviso = admin.locator('[data-bloque="sin-aviso"]');
  await expect(bloqueSinAviso).toContainText("Todos los productos avisan.");
  await bloqueSinAviso.locator("select").selectOption({ label: "Gin" });
  await bloqueSinAviso.locator('button[type="submit"]').click();
  await expect(mensaje).toHaveText('"Gin" ya no se avisa cuando está en 0.');
  await expect(bloqueSinAviso.locator(".admin-item")).toHaveCount(1);
  await bloqueSinAviso.locator('[data-accion="volver-a-avisar"]').click();
  await expect(mensaje).toHaveText('"Gin" vuelve a avisarse cuando está en 0.');
  await expect(bloqueSinAviso).toContainText("Todos los productos avisan.");

  const llamadas = await page.evaluate(() => globalThis.__mockAdminLlamadas.map((l) => l.nombre));
  expect(llamadas).toEqual([
    "agregarEmpleado",
    "agregarEmpleado",
    "eliminarEmpleado",
    "agregarCategoria",
    "agregarProducto",
    "eliminarProducto",
    "moverProducto",
    "cambiarAvisoSinStock",
    "cambiarAvisoSinStock",
  ]);
});

test("supervisor smoke: sin sesion no se ve el boton de admin y al cerrar sesion se oculta el panel", async ({ page }) => {
  await mockAppServices(page);
  await page.goto("/supervisor.html");

  await expect(page.locator("#btn-admin")).toBeHidden();
  await expect(page.locator("#seccion-admin")).toBeHidden();

  await mockAppServices(page, { authenticatedSupervisor: true });
  await page.goto("/supervisor.html");
  await page.click("#btn-admin");
  await expect(page.locator("#seccion-admin")).toBeVisible();

  await page.click("#btn-cerrar-sesion-supervisor");
  await expect(page.locator("#btn-admin")).toBeHidden();
  await expect(page.locator("#seccion-admin")).toBeHidden();
});
