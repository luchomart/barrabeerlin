import { describe, expect, it } from "vitest";

import {
  buildConsultaStock,
  buscarEnConsulta,
} from "../../js/modules/stock/stockConsulta.js";

const productos = [
  { id: 1, nombre: "Red Ipa" },
  { id: 2, nombre: "IPA" },
  { id: 3, nombre: "Coca Cola" },
  { id: 4, nombre: "Gin Bombay" },
];

const sectores = [
  { id: "1", nombre: "Camara" },
  { id: "2", nombre: "Estantes Barra" },
];

const inventario = [
  { producto_id: 1, sector_id: "1", cantidad: 2, ultima_actualizacion: "2026-11-23T20:00:00Z" },
  { producto_id: 3, sector_id: "1", cantidad: 6, ultima_actualizacion: "2026-11-23T20:00:00Z" },
  { producto_id: 3, sector_id: "2", cantidad: 8, ultima_actualizacion: "2026-11-23T21:00:00Z" },
  { producto_id: 2, sector_id: "2", cantidad: 0, ultima_actualizacion: "2026-11-22T21:00:00Z" },
  { producto_id: 4, sector_id: "2", cantidad: "1.5", ultima_actualizacion: null },
];

describe("buildConsultaStock", () => {
  const items = buildConsultaStock({ productos, sectores, inventario });
  const porId = Object.fromEntries(items.map((item) => [item.id, item]));

  it("suma el stock de todos los sectores y lista donde hay, de mayor a menor", () => {
    expect(porId[3].total).toBe(14);
    expect(porId[3].sectores.map((s) => [s.sector, s.cantidad])).toEqual([
      ["Estantes Barra", 8],
      ["Camara", 6],
    ]);
  });

  it("un producto en 0 o sin conteo queda con total 0 y sin sectores", () => {
    expect(porId[2]).toMatchObject({ total: 0, sectores: [] });
    expect(porId[2].ultimoConteo?.toISOString()).toBe("2026-11-22T21:00:00.000Z");
  });

  it("toma el conteo mas nuevo y acepta decimales", () => {
    expect(porId[3].ultimoConteo.toISOString()).toBe("2026-11-23T21:00:00.000Z");
    expect(porId[4].total).toBe(1.5);
    expect(porId[4].ultimoConteo).toBeNull();
  });

  it("no se rompe sin datos", () => {
    expect(buildConsultaStock()).toEqual([]);
    expect(buildConsultaStock({ productos: [{ id: 9, nombre: "Agua" }] })[0]).toMatchObject({
      total: 0,
      ultimoConteo: null,
    });
  });
});

describe("buscarEnConsulta", () => {
  const items = buildConsultaStock({ productos, sectores, inventario });

  it("sin texto no devuelve nada", () => {
    expect(buscarEnConsulta(items, "  ")).toEqual({ resultados: [], cantidad: 0 });
  });

  it("ignora tildes y mayusculas, y pone primero los que hay", () => {
    const { resultados } = buscarEnConsulta(items, "ÍPA");

    expect(resultados.map((item) => item.nombre)).toEqual(["Red Ipa", "IPA"]);
  });

  it("todas las palabras tienen que estar, en cualquier orden", () => {
    expect(buscarEnConsulta(items, "ipa red").resultados.map((item) => item.id)).toEqual([1]);
    expect(buscarEnConsulta(items, "ipa coca").resultados).toEqual([]);
  });

  it("corta en el limite pero informa cuantos hay en total", () => {
    const resultado = buscarEnConsulta(items, "a", 2);

    expect(resultado.resultados).toHaveLength(2);
    expect(resultado.cantidad).toBe(4);
  });
});
