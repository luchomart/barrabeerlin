import { beforeEach, describe, expect, it, vi } from "vitest";

const scenario = {
  fechaRanges: [],
  snapshotByFecha: new Map(),
  inserted: [],
  insertResponse: null,
};

function buildStockSnapshotsTable() {
  return {
    select(fields) {
      if (fields === "fecha") {
        return {
          order() {
            return {
              range() {
                return Promise.resolve({
                  data: scenario.fechaRanges.shift() || [],
                  error: null,
                });
              },
            };
          },
        };
      }

      if (fields === "producto_id, cantidad, fecha") {
        return {
          eq(_column, value) {
            return Promise.resolve({
              data: scenario.snapshotByFecha.get(value) || [],
              error: null,
            });
          },
        };
      }

      throw new Error(`Select no esperado: ${fields}`);
    },

    insert(rows) {
      scenario.inserted.push(rows);

      return {
        select() {
          return Promise.resolve({
            data: scenario.insertResponse || rows,
            error: null,
          });
        },
      };
    },
  };
}

const mockSupabase = {
  from(table) {
    if (table !== "stock_snapshots") {
      throw new Error(`Tabla no mockeada: ${table}`);
    }

    return buildStockSnapshotsTable();
  },
};

vi.mock("../../js/services/supabaseClient.js", () => ({
  supabase: mockSupabase,
}));

const {
  getDiferenciasStock,
  saveStockSnapshot,
} = await import("../../js/services/inventarioService.js");

describe("inventarioService snapshots", () => {
  beforeEach(() => {
    scenario.fechaRanges = [];
    scenario.snapshotByFecha = new Map();
    scenario.inserted = [];
    scenario.insertResponse = null;
    vi.useRealTimers();
  });

  it("devuelve invalid cuando no recibe stock valido", async () => {
    await expect(saveStockSnapshot()).resolves.toEqual({
      status: "invalid",
      fecha: null,
      registros: [],
      resumen: null,
    });
  });

  it("crea snapshot normalizado cuando no hay uno reciente equivalente", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-09T10:00:00.000Z"));

    scenario.fechaRanges = [[]];

    const resultado = await saveStockSnapshot({
      stockPorProducto: {
        1: 3,
        2: -4,
        invalido: 9,
      },
    });

    expect(resultado.status).toBe("created");
    expect(resultado.fecha).toBe("2026-04-09T10:00:00.000Z");
    expect(resultado.resumen).toEqual({
      fecha: "2026-04-09T10:00:00.000Z",
      totalProductos: 2,
      totalUnidades: 3,
      fingerprint: "1:3|2:0",
    });
    expect(scenario.inserted).toEqual([
      [
        {
          producto_id: 1,
          cantidad: 3,
          fecha: "2026-04-09T10:00:00.000Z",
        },
        {
          producto_id: 2,
          cantidad: 0,
          fecha: "2026-04-09T10:00:00.000Z",
        },
      ],
    ]);
  });

  it("devuelve empty cuando no quedan registros validos para snapshot", async () => {
    const resultado = await saveStockSnapshot({
      stockPorProducto: {
        invalido: 3,
      },
    });

    expect(resultado).toEqual({
      status: "empty",
      fecha: null,
      registros: [],
      resumen: {
        fecha: null,
        totalProductos: 0,
        totalUnidades: 0,
        fingerprint: "",
      },
    });
  });

  it("deduplica snapshots recientes con el mismo contenido", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-09T10:00:05.000Z"));

    const fecha = "2026-04-09T10:00:00.000Z";
    scenario.fechaRanges = [[{ fecha }]];
    scenario.snapshotByFecha.set(fecha, [
      { producto_id: 1, cantidad: 3, fecha },
      { producto_id: 2, cantidad: 1, fecha },
    ]);

    const resultado = await saveStockSnapshot({
      stockPorProducto: {
        1: 3,
        2: 1,
      },
    });

    expect(resultado.status).toBe("deduplicated");
    expect(resultado.fecha).toBe(fecha);
    expect(resultado.resumen).toEqual({
      fecha,
      totalProductos: 2,
      totalUnidades: 4,
      fingerprint: "1:3|2:1",
    });
    expect(scenario.inserted).toEqual([]);
  });

  it("compara los dos ultimos snapshots y devuelve diferencias ordenadas", async () => {
    const fechaActual = "2026-04-09T10:00:00.000Z";
    const fechaAnterior = "2026-04-09T09:00:00.000Z";

    scenario.fechaRanges = [[
      { fecha: fechaActual },
      { fecha: fechaAnterior },
    ]];

    scenario.snapshotByFecha.set(fechaActual, [
      { producto_id: 1, cantidad: 12, fecha: fechaActual },
      { producto_id: 2, cantidad: 4, fecha: fechaActual },
      { producto_id: 3, cantidad: 6, fecha: fechaActual },
    ]);

    scenario.snapshotByFecha.set(fechaAnterior, [
      { producto_id: 1, cantidad: 8, fecha: fechaAnterior },
      { producto_id: 2, cantidad: 10, fecha: fechaAnterior },
      { producto_id: 3, cantidad: 6, fecha: fechaAnterior },
    ]);

    const diferencias = await getDiferenciasStock();

    expect(diferencias).toEqual([
      {
        producto_id: 2,
        actual: 4,
        anterior: 10,
        diferencia: -6,
        magnitud: 6,
        tipo: "salida",
        snapshot_actual_fecha: fechaActual,
        snapshot_anterior_fecha: fechaAnterior,
      },
      {
        producto_id: 1,
        actual: 12,
        anterior: 8,
        diferencia: 4,
        magnitud: 4,
        tipo: "entrada",
        snapshot_actual_fecha: fechaActual,
        snapshot_anterior_fecha: fechaAnterior,
      },
      {
        producto_id: 3,
        actual: 6,
        anterior: 6,
        diferencia: 0,
        magnitud: 0,
        tipo: "sin_cambio",
        snapshot_actual_fecha: fechaActual,
        snapshot_anterior_fecha: fechaAnterior,
      },
    ]);
  });

  it("devuelve lista vacia cuando no hay dos snapshots suficientes", async () => {
    scenario.fechaRanges = [[{ fecha: "2026-04-16T10:00:00.000Z" }]];
    scenario.snapshotByFecha.set("2026-04-16T10:00:00.000Z", [
      { producto_id: 1, cantidad: 4, fecha: "2026-04-16T10:00:00.000Z" },
    ]);

    await expect(getDiferenciasStock()).resolves.toEqual([]);
  });

  it("ignora filas invalidas al comparar snapshots", async () => {
    const fechaActual = "2026-04-16T10:00:00.000Z";
    const fechaAnterior = "2026-04-16T09:00:00.000Z";

    scenario.fechaRanges = [[
      { fecha: fechaActual },
      { fecha: fechaAnterior },
    ]];

    scenario.snapshotByFecha.set(fechaActual, [
      { producto_id: "invalido", cantidad: 9, fecha: fechaActual },
      { producto_id: 1, cantidad: 5, fecha: fechaActual },
    ]);

    scenario.snapshotByFecha.set(fechaAnterior, [
      { producto_id: null, cantidad: 2, fecha: fechaAnterior },
      { producto_id: 1, cantidad: 1, fecha: fechaAnterior },
    ]);

    await expect(getDiferenciasStock()).resolves.toEqual([
      {
        producto_id: 1,
        actual: 5,
        anterior: 1,
        diferencia: 4,
        magnitud: 4,
        tipo: "entrada",
        snapshot_actual_fecha: fechaActual,
        snapshot_anterior_fecha: fechaAnterior,
      },
    ]);
  });
});
