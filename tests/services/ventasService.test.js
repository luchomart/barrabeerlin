import { beforeEach, describe, expect, it, vi } from "vitest";

const scenario = {
  rpcCalls: [],
  rpcResponse: null,
  rpcError: null,
};

const mockSupabase = {
  rpc(name, params) {
    scenario.rpcCalls.push({ name, params });

    return Promise.resolve({
      data: scenario.rpcResponse,
      error: scenario.rpcError,
    });
  },
};

vi.mock("../../js/services/supabaseClient.js", () => ({
  supabase: mockSupabase,
}));

const {
  normalizarCantidadVenta,
  normalizarResultadoVenta,
  normalizarStockVendido,
  registrarVenta,
} = await import("../../js/services/ventasService.js");

describe("ventasService", () => {
  beforeEach(() => {
    scenario.rpcCalls = [];
    scenario.rpcResponse = null;
    scenario.rpcError = null;
  });

  it("normaliza cantidades de venta", () => {
    expect(normalizarCantidadVenta("6")).toBe(6);
    expect(normalizarCantidadVenta(4.9)).toBe(4);
    expect(normalizarCantidadVenta(-2)).toBe(0);
    expect(normalizarCantidadVenta("abc")).toBe(0);
    expect(normalizarCantidadVenta(9999)).toBe(1000);
  });

  it("normaliza stock vendido e ignora productos invalidos", () => {
    expect(
      normalizarStockVendido({
        101: "3",
        0: 8,
        invalido: 9,
        202: -1,
        303: 1005,
      }),
    ).toEqual({
      101: 3,
      303: 1000,
    });
  });

  it("devuelve empty sin llamar RPC cuando no hay productos validos", async () => {
    await expect(
      registrarVenta({
        stockVendido: {
          invalido: 2,
          0: 4,
        },
        empleado: "Karen",
      }),
    ).resolves.toEqual({
      status: "empty",
      venta_id: null,
      detalles: [],
      descuentos: [],
    });

    expect(scenario.rpcCalls).toEqual([]);
  });

  it("llama RPC registrar_venta con payload normalizado", async () => {
    scenario.rpcResponse = {
      status: "created",
      venta_id: "venta-1",
      detalles: [
        {
          producto_id: "101",
          cantidad: "10",
          descontado: "7",
          faltante: "3",
        },
      ],
      descuentos: [
        {
          producto_id: "101",
          sector_id: "1",
          sector_nombre: "Exhibidoras",
          cantidad_descontada: "4",
          prioridad: "1",
        },
      ],
    };

    await expect(
      registrarVenta({
        stockVendido: {
          101: "10",
          202: 0,
        },
        empleado: " Karen ",
        observacion: " Cierre noche ",
      }),
    ).resolves.toEqual({
      status: "created",
      venta_id: "venta-1",
      detalles: [
        {
          producto_id: 101,
          cantidad: 10,
          descontado: 7,
          faltante: 3,
        },
      ],
      descuentos: [
        {
          producto_id: 101,
          sector_id: "1",
          sector_nombre: "Exhibidoras",
          cantidad_descontada: 4,
          prioridad: 1,
        },
      ],
    });

    expect(scenario.rpcCalls).toEqual([
      {
        name: "registrar_venta",
        params: {
          stock_vendido: { 101: 10 },
          empleado: "Karen",
          observacion: "Cierre noche",
        },
      },
    ]);
  });

  it("normaliza resultados vacios o incompletos", () => {
    expect(normalizarResultadoVenta()).toEqual({
      status: "invalid",
      venta_id: null,
      detalles: [],
      descuentos: [],
    });
  });

  it("propaga errores de Supabase", async () => {
    scenario.rpcError = new Error("rpc registrar_venta error");

    await expect(
      registrarVenta({
        stockVendido: { 101: 1 },
      }),
    ).rejects.toThrow("rpc registrar_venta error");
  });
});
