import { beforeEach, describe, expect, it } from "vitest";

import { appState } from "../../js/core/appState.js";

describe("appState", () => {
  beforeEach(() => {
    appState.empleado = "";
    appState.sector = "";
    appState.sectorAnterior = "";
    appState.cambiosPendientes = false;
    appState.productos = [];
    appState.categorias = [];
    appState.sectores = [];
  });

  it("setCatalogo clona arrays y se defiende de valores invalidos", () => {
    const productos = [{ id: 1 }];
    const categorias = [{ id: 10 }];
    const sectores = [{ id: 100 }];

    appState.setCatalogo({ productos, categorias, sectores });

    expect(appState.productos).toEqual(productos);
    expect(appState.categorias).toEqual(categorias);
    expect(appState.sectores).toEqual(sectores);
    expect(appState.productos).not.toBe(productos);

    appState.setCatalogo({ productos: null, categorias: "x", sectores: {} });

    expect(appState.productos).toEqual([]);
    expect(appState.categorias).toEqual([]);
    expect(appState.sectores).toEqual([]);
  });

  it("actualiza empleado y cambios pendientes", () => {
    appState.setEmpleado("Karen");
    appState.setCambiosPendientes(1);

    expect(appState.empleado).toBe("Karen");
    expect(appState.cambiosPendientes).toBe(true);
  });

  it("mantiene rollback y reset de sector", () => {
    appState.setSector("1");
    appState.setSector("2");

    expect(appState.sector).toBe("2");
    expect(appState.sectorAnterior).toBe("1");

    appState.rollbackSector();

    expect(appState.sector).toBe("1");

    appState.setCambiosPendientes(true);
    appState.resetSector();

    expect(appState.sector).toBe("");
    expect(appState.sectorAnterior).toBe("");
    expect(appState.cambiosPendientes).toBe(false);
  });
});
