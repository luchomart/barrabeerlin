import { beforeEach, describe, expect, it, vi } from "vitest";

const scenario = { empleados: [], error: null };

const mockSupabase = {
  from(tabla) {
    if (tabla !== "empleados") throw new Error(`Tabla no esperada: ${tabla}`);

    return {
      select() {
        return {
          order() {
            return Promise.resolve({ data: scenario.empleados, error: scenario.error });
          },
        };
      },
    };
  },
};

vi.mock("../../js/services/supabaseClient.js", () => ({
  supabase: mockSupabase,
}));

const { getEmpleados } = await import("../../js/services/catalogoService.js");

describe("catalogoService.getEmpleados", () => {
  beforeEach(() => {
    scenario.empleados = [];
    scenario.error = null;
  });

  it("ordena alfabeticamente sin distinguir mayusculas ni acentos", async () => {
    scenario.empleados = [
      { id: 1, nombre: "Karen" },
      { id: 2, nombre: "Luciano" },
      { id: 3, nombre: "bruno" },
      { id: 4, nombre: "dana" },
      { id: 5, nombre: "Álvaro" },
    ];

    const empleados = await getEmpleados();

    expect(empleados.map((e) => e.nombre)).toEqual([
      "Álvaro",
      "bruno",
      "dana",
      "Karen",
      "Luciano",
    ]);
  });

  it("devuelve lista vacia si no hay datos y propaga errores", async () => {
    scenario.empleados = null;
    await expect(getEmpleados()).resolves.toEqual([]);

    scenario.error = new Error("sin red");
    await expect(getEmpleados()).rejects.toThrow("sin red");
  });
});
