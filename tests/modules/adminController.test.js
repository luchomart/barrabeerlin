// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const servicios = vi.hoisted(() => ({
  getEmpleados: vi.fn(),
  getCategorias: vi.fn(),
  getProductos: vi.fn(),
  getSupervisorInventarioConSectores: vi.fn(),
  agregarEmpleado: vi.fn(),
}));

vi.mock("../../js/services/catalogoService.js", () => ({
  getEmpleados: servicios.getEmpleados,
  getCategorias: servicios.getCategorias,
  getProductos: servicios.getProductos,
}));

vi.mock("../../js/services/inventarioService.js", () => ({
  getSupervisorInventarioConSectores: servicios.getSupervisorInventarioConSectores,
}));

vi.mock("../../js/services/adminService.js", () => ({
  agregarCategoria: vi.fn(),
  agregarEmpleado: servicios.agregarEmpleado,
  agregarProducto: vi.fn(),
  eliminarCategoria: vi.fn(),
  eliminarEmpleado: vi.fn(),
  eliminarProducto: vi.fn(),
}));

const { initAdminPanel } = await import("../../js/modules/supervisor/adminController.js");

function diferido() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function esperar() {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
}

function montarPanel() {
  document.body.innerHTML = `
    <button id="btn-admin"></button>
    <section id="admin" hidden><div id="admin-contenido"></div></section>
  `;

  const section = document.getElementById("admin");
  const contenido = document.getElementById("admin-contenido");
  const button = document.getElementById("btn-admin");

  section.scrollIntoView = vi.fn();
  initAdminPanel({ section, contenido, button });

  return { section, contenido, button };
}

function nombresEmpleados(contenido) {
  return contenido.textContent;
}

describe("adminController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    servicios.getCategorias.mockResolvedValue([]);
    servicios.getProductos.mockResolvedValue([]);
    servicios.getSupervisorInventarioConSectores.mockResolvedValue([]);
  });

  it("una carga vieja que termina ultima no pisa a la nueva", async () => {
    const vieja = diferido();
    servicios.getEmpleados
      .mockReturnValueOnce(vieja.promise)
      .mockResolvedValueOnce([{ id: 1, nombre: "Nueva" }]);

    const { button, contenido } = montarPanel();

    button.click(); // abre: carga 1 (queda colgada)
    button.click(); // cierra
    button.click(); // abre: carga 2
    await esperar();

    expect(nombresEmpleados(contenido)).toContain("Nueva");

    vieja.resolve([{ id: 1, nombre: "Vieja" }]);
    await esperar();

    expect(nombresEmpleados(contenido)).toContain("Nueva");
    expect(nombresEmpleados(contenido)).not.toContain("Vieja");
  });

  it("una carga superada espera el resultado de la nueva: si esa falla, avisa que se guardo", async () => {
    const vieja = diferido();
    const nueva = diferido();
    servicios.getEmpleados
      .mockResolvedValueOnce([]) // apertura
      .mockReturnValueOnce(vieja.promise) // recarga tras agregar
      .mockReturnValueOnce(nueva.promise); // reapertura mientras tanto
    servicios.agregarEmpleado.mockResolvedValue({ id: 9, nombre: "Eve" });

    const { button, contenido } = montarPanel();
    vi.spyOn(console, "error").mockImplementation(() => {});

    button.click();
    await esperar();

    const form = contenido.querySelector('form[data-form="empleado"]');
    form.querySelector('[name="nombre"]').value = "Eve";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await esperar();

    button.click(); // cierra
    button.click(); // abre: carga mas nueva
    vieja.resolve([{ id: 9, nombre: "Eve" }]);
    await esperar();
    nueva.reject(new Error("sin red"));
    await esperar();

    expect(contenido.textContent).toContain("no se pudo actualizar la lista");
  });

  it("si el cambio se guarda pero falla la recarga, avisa que se guardo", async () => {
    servicios.getEmpleados
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("sin red"));
    servicios.agregarEmpleado.mockResolvedValue({ id: 9, nombre: "Eve" });

    const { button, contenido } = montarPanel();
    vi.spyOn(console, "error").mockImplementation(() => {});

    button.click();
    await esperar();

    const form = contenido.querySelector('form[data-form="empleado"]');
    form.querySelector('[name="nombre"]').value = "Eve";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await esperar();

    expect(servicios.agregarEmpleado).toHaveBeenCalledWith("Eve");
    expect(contenido.textContent).toContain('Empleado "Eve" agregado.');
    expect(contenido.textContent).toContain("no se pudo actualizar la lista");
  });
});
