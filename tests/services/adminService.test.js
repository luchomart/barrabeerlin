import { beforeEach, describe, expect, it, vi } from "vitest";

const scenario = {
  rpcCalls: [],
  rpcResponse: null,
  rpcError: null,
};

vi.mock("../../js/services/supabaseClient.js", () => ({
  supabase: {
    rpc(name, params) {
      scenario.rpcCalls.push({ name, params });

      return Promise.resolve({ data: scenario.rpcResponse, error: scenario.rpcError });
    },
  },
}));

const {
  agregarCategoria,
  agregarEmpleado,
  agregarProducto,
  eliminarCategoria,
  eliminarEmpleado,
  eliminarProducto,
  moverProducto,
  cambiarAvisoSinStock,
  obtenerMensajeErrorAdmin,
} = await import("../../js/services/adminService.js");

describe("adminService", () => {
  beforeEach(() => {
    scenario.rpcCalls = [];
    scenario.rpcResponse = { id: 1 };
    scenario.rpcError = null;
  });

  it("llama a cada RPC con los parametros que espera Supabase", async () => {
    await agregarEmpleado("  Juan   Pablo ");
    await eliminarEmpleado("3");
    await agregarCategoria("Sidras");
    await eliminarCategoria(14);
    await agregarProducto("Fanta", "2");
    await eliminarProducto(11);
    await moverProducto("11", 14);
    await cambiarAvisoSinStock("11", false);

    expect(scenario.rpcCalls).toEqual([
      { name: "admin_agregar_empleado", params: { nombre: "Juan Pablo" } },
      { name: "admin_eliminar_empleado", params: { empleado_id: 3 } },
      { name: "admin_agregar_categoria", params: { nombre: "Sidras" } },
      { name: "admin_eliminar_categoria", params: { categoria_id: 14 } },
      { name: "admin_agregar_producto", params: { nombre: "Fanta", categoria_id: 2 } },
      { name: "admin_eliminar_producto", params: { producto_id: 11 } },
      { name: "admin_mover_producto", params: { producto_id: 11, categoria_id: 14 } },
      { name: "admin_avisar_sin_stock", params: { producto_id: 11, avisar: false } },
    ]);
  });

  it("valida nombre e ids antes de llamar a Supabase", async () => {
    await expect(agregarEmpleado("   ")).rejects.toThrow("vacio");
    await expect(eliminarProducto("abc")).rejects.toThrow("invalido");
    await expect(agregarProducto("Fanta", "")).rejects.toThrow("invalido");
    await expect(moverProducto(11, "")).rejects.toThrow("invalido");
    expect(scenario.rpcCalls).toEqual([]);
  });

  it("propaga el mensaje de la RPC como error legible", async () => {
    scenario.rpcError = {
      code: "23503",
      message: "La categoria tiene 2 producto(s). Borralos primero.",
    };

    await expect(eliminarCategoria(2)).rejects.toThrow(
      "La categoria tiene 2 producto(s). Borralos primero.",
    );
  });

  it("traduce errores tecnicos de permisos y red", () => {
    expect(
      obtenerMensajeErrorAdmin({
        code: "42501",
        message: "permission denied for function admin_agregar_empleado",
      }),
    ).toBe("Solo el supervisor puede hacer cambios de administracion.");
    expect(obtenerMensajeErrorAdmin({ message: "TypeError: Failed to fetch" })).toBe(
      "No se pudo conectar con el servidor.",
    );
    expect(obtenerMensajeErrorAdmin(null)).toBe("No se pudo completar la operacion.");
  });
});
