import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  agregarPendiente,
  borrarBorrador,
  enviarPendientes,
  esErrorDeRed,
  guardarBorrador,
  guardarEmpleadosCache,
  hayConteoMasNuevo,
  leerBorrador,
  leerEmpleadosCache,
  leerUltimoBorrador,
  leerPendientes,
} from "../../js/modules/stock/stockBorrador.js";

function crearStorage() {
  const datos = new Map();

  return {
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => datos.set(clave, String(valor)),
    removeItem: (clave) => datos.delete(clave),
    datos,
  };
}

describe("stockBorrador", () => {
  let storage;

  beforeEach(() => {
    storage = crearStorage();
  });

  it("guarda, lee y borra el borrador del sector", () => {
    guardarBorrador(
      { sector_id: 1, sector_nombre: "Camara", empleado: "Karen", cantidades: { 101: "6" } },
      storage,
    );

    expect(leerBorrador(1, storage)).toMatchObject({
      sector_id: "1",
      sector_nombre: "Camara",
      empleado: "Karen",
      cantidades: { 101: "6" },
    });

    borrarBorrador(1, storage);
    expect(leerBorrador(1, storage)).toBeNull();
  });

  it("guarda un borrador por sector y sabe cual es el ultimo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T10:00:00Z"));
    guardarBorrador({ sector_id: 1, cantidades: { 101: "6" } }, storage);
    vi.setSystemTime(new Date("2026-11-17T10:05:00Z"));
    guardarBorrador({ sector_id: 2, cantidades: { 201: "3" } }, storage);
    vi.useRealTimers();

    expect(leerBorrador(1, storage).cantidades).toEqual({ 101: "6" });
    expect(leerBorrador(2, storage).cantidades).toEqual({ 201: "3" });
    expect(leerUltimoBorrador(storage).sector_id).toBe("2");

    borrarBorrador(2, storage);
    expect(leerUltimoBorrador(storage).sector_id).toBe("1");
  });

  it("un borrador sin cantidades no se guarda y uno corrupto se ignora", () => {
    guardarBorrador({ sector_id: 1, cantidades: {} }, storage);
    expect(leerBorrador(1, storage)).toBeNull();

    storage.setItem("stock-borradores", "{no es json");
    expect(leerBorrador(1, storage)).toBeNull();
    expect(leerUltimoBorrador(storage)).toBeNull();
  });

  it("no rompe si el almacenamiento falla o no existe", () => {
    const roto = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("lleno");
      },
      removeItem: () => {},
    };

    expect(guardarBorrador({ sector_id: 1, cantidades: { 1: "2" } }, roto)).toBe(false);
    expect(leerBorrador(1, roto)).toBeNull();
    expect(agregarPendiente({ registros: [{}], sector_id: 1 }, roto)).toBeNull();
    expect(leerPendientes(null)).toEqual([]);
  });

  it("encola pendientes en orden", () => {
    agregarPendiente({ registros: [{ a: 1 }], sector_id: 1, sector_nombre: "Camara" }, storage);
    agregarPendiente({ registros: [{ a: 2 }], sector_id: 2, sector_nombre: "Cocina" }, storage);

    expect(leerPendientes(storage).map((p) => p.sector_nombre)).toEqual(["Camara", "Cocina"]);
  });

  it("guarda la copia de empleados solo con id y nombre", () => {
    guardarEmpleadosCache([{ id: 1, nombre: "Karen", extra: "x" }, { id: 2 }], storage);

    expect(leerEmpleadosCache(storage)).toEqual([{ id: 1, nombre: "Karen" }]);
  });

  it("reconoce errores de red de distintos navegadores", () => {
    expect(esErrorDeRed({ message: "TypeError: Failed to fetch" }, true)).toBe(true);
    expect(esErrorDeRed({ message: "NetworkError when attempting to fetch resource." }, true)).toBe(true);
    expect(esErrorDeRed({ message: "Load failed" }, true)).toBe(true);
    expect(esErrorDeRed({ message: "cualquier cosa" }, false)).toBe(true);
    expect(esErrorDeRed({ message: "new row violates row-level security policy" }, true)).toBe(false);
  });

  it("detecta si el sector tiene un conteo posterior", () => {
    const creado = "2026-11-17T10:00:00.000Z";

    expect(hayConteoMasNuevo([{ ultima_actualizacion: "2026-11-17T09:00:00+00:00" }], creado)).toBe(false);
    expect(hayConteoMasNuevo([{ ultima_actualizacion: "2026-11-17T10:00:00+00:00" }], creado)).toBe(false);
    expect(hayConteoMasNuevo([{ ultima_actualizacion: "2026-11-17T10:00:01+00:00" }], creado)).toBe(true);
    expect(hayConteoMasNuevo([{}], creado)).toBe(false);
  });

  it("un pendiente que no se puede enviar sale de la cola y no traba a los demas", async () => {
    agregarPendiente({ registros: [{ id: "a" }], sector_id: 1 }, storage);
    agregarPendiente({ registros: [{ id: "b" }], sector_id: 2 }, storage);

    const guardarInventario = vi.fn(async (registros) => {
      if (registros[0].id === "a") throw { message: "violates foreign key constraint" };
    });

    const resultado = await enviarPendientes({
      getInventarioSector: async () => [],
      guardarInventario,
      storage,
    });

    expect(resultado.fallidos.map((p) => p.motivo)).toEqual(["violates foreign key constraint"]);
    expect(resultado.enviados.map((p) => p.sector_id)).toEqual(["2"]);
    expect(leerPendientes(storage)).toEqual([]);
  });

  it("envia pendientes, descarta los pisados y corta si sigue sin red", async () => {
    agregarPendiente(
      { registros: [{ id: "a" }], sector_id: 1, creado: "2026-11-17T10:00:00.000Z" },
      storage,
    );
    agregarPendiente(
      { registros: [{ id: "b" }], sector_id: 2, creado: "2026-11-17T10:00:00.000Z" },
      storage,
    );
    agregarPendiente(
      { registros: [{ id: "c" }], sector_id: 3, creado: "2026-11-17T10:00:00.000Z" },
      storage,
    );

    const guardarInventario = vi.fn().mockResolvedValue();
    const getInventarioSector = vi.fn(async (sectorId) => {
      if (sectorId === "2") return [{ ultima_actualizacion: "2026-11-17T12:00:00Z" }];
      if (sectorId === "3") throw { message: "TypeError: Failed to fetch" };
      return [];
    });

    const resultado = await enviarPendientes({ getInventarioSector, guardarInventario, storage });

    expect(resultado.enviados.map((p) => p.sector_id)).toEqual(["1"]);
    expect(resultado.descartados.map((p) => p.sector_id)).toEqual(["2"]);
    expect(resultado.error).toBeTruthy();
    expect(guardarInventario).toHaveBeenCalledTimes(1);
    expect(guardarInventario).toHaveBeenCalledWith([{ id: "a" }]);
    expect(leerPendientes(storage).map((p) => p.sector_id)).toEqual(["3"]);
  });
});
