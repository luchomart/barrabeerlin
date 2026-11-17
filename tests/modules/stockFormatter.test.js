import { beforeEach, describe, expect, it, vi } from "vitest";

const getInventarioTotalMock = vi.fn();

vi.mock("../../js/services/inventarioService.js", () => ({
  getInventarioTotal: getInventarioTotalMock,
}));

const {
  buildStockData,
  buildStockDataFromInventario,
  buildStockChanges,
  buildStockChangesReport,
  formatPlainText,
  formatStockChanges,
  formatWhatsappText,
  obtenerEmojiCategoria,
} = await import("../../js/modules/stock/stockFormatter.js");

describe("stockFormatter", () => {
  beforeEach(() => {
    getInventarioTotalMock.mockReset();
  });

  it("agrupa inventario por producto y ordena categorias", () => {
    const inventario = [
      { producto_id: 1, cantidad: 3 },
      { producto_id: 1, cantidad: 2 },
      { producto_id: 2, cantidad: 5 },
    ];

    const categorias = [
      { id: 3, nombre: "Vinos" },
      { id: 1, nombre: "Destilados, licores y aperitivos" },
      { id: 2, nombre: "Gaseosas" },
    ];

    const data = buildStockDataFromInventario(inventario, [], categorias);

    expect(data.stockPorProducto).toEqual({
      1: 5,
      2: 5,
    });
    expect(data.categoriasOrdenadas.map((categoria) => categoria.nombre)).toEqual([
      "Gaseosas",
      "Vinos",
      "Destilados, licores y aperitivos",
    ]);
  });

  it("usa getInventarioTotal en el wrapper async buildStockData", async () => {
    getInventarioTotalMock.mockResolvedValue([
      { producto_id: 7, cantidad: 4 },
      { producto_id: 7, cantidad: 1 },
    ]);

    const data = await buildStockData([], []);

    expect(getInventarioTotalMock).toHaveBeenCalledTimes(1);
    expect(data.stockPorProducto).toEqual({ 7: 5 });
  });

  it("arma el reporte global de cambios con totales, limite y fechas", () => {
    const diferencias = [
      {
        producto_id: 1,
        actual: 15,
        anterior: 5,
        diferencia: 10,
        tipo: "entrada",
        snapshot_actual_fecha: "2026-04-09T10:00:00.000Z",
        snapshot_anterior_fecha: "2026-04-09T09:00:00.000Z",
      },
      {
        producto_id: 2,
        actual: 4,
        anterior: 10,
        diferencia: -6,
        tipo: "salida",
        snapshot_actual_fecha: "2026-04-09T10:00:00.000Z",
        snapshot_anterior_fecha: "2026-04-09T09:00:00.000Z",
      },
      {
        producto_id: 3,
        actual: 8,
        anterior: 8,
        diferencia: 0,
        tipo: "sin_cambio",
        snapshot_actual_fecha: "2026-04-09T10:00:00.000Z",
        snapshot_anterior_fecha: "2026-04-09T09:00:00.000Z",
      },
    ];

    const productos = [
      { id: 1, nombre: "IPA" },
      { id: 2, nombre: "Stout" },
      { id: 3, nombre: "Honey" },
    ];

    const reporte = buildStockChangesReport(diferencias, productos, 1);

    expect(reporte.tieneComparacion).toBe(true);
    expect(reporte.hayCambios).toBe(true);
    expect(reporte.snapshotActualFecha).toBe("2026-04-09T10:00:00.000Z");
    expect(reporte.snapshotAnteriorFecha).toBe("2026-04-09T09:00:00.000Z");
    expect(reporte.totalEntradas).toBe(10);
    expect(reporte.totalSalidas).toBe(-6);
    expect(reporte.entradas).toHaveLength(1);
    expect(reporte.salidas).toHaveLength(1);
    expect(reporte.sinCambios).toHaveLength(1);
    expect(reporte.entradas[0].nombre).toBe("IPA");
    expect(reporte.salidas[0].nombre).toBe("Stout");
  });

  it("formatea el texto global de cambios", () => {
    const diferencias = [
      { producto_id: 1, actual: 8, anterior: 12, diferencia: -4, tipo: "salida" },
      { producto_id: 2, actual: 10, anterior: 7, diferencia: 3, tipo: "entrada" },
      { producto_id: 3, actual: 5, anterior: 5, diferencia: 0, tipo: "sin_cambio" },
    ];

    const productos = [
      { id: 1, nombre: "IPA" },
      { id: 2, nombre: "Honey" },
      { id: 3, nombre: "Amber" },
    ];

    const texto = formatStockChanges(diferencias, productos);

    expect(texto).toContain("CAMBIOS DE STOCK (GLOBAL)");
    expect(texto).toContain("SALIDAS");
    expect(texto).toContain("- IPA: -4");
    expect(texto).toContain("ENTRADAS");
    expect(texto).toContain("- Honey: +3");
    expect(texto).toContain("SIN CAMBIOS");
    expect(texto).toContain("- Amber");
  });

  it("formatea stock para WhatsApp y omite cantidades en cero", () => {
    const texto = formatWhatsappText(
      {
        categoriasOrdenadas: [
          { id: 2, nombre: "Gaseosas" },
          { id: 1, nombre: "Cervezas" },
        ],
        stockPorProducto: {
          10: 6,
          11: 0,
          12: 4,
        },
      },
      [
        { id: 10, nombre: "Coca Cola", categoria_id: 2 },
        { id: 11, nombre: "Sprite", categoria_id: 2 },
        { id: 12, nombre: "IPA", categoria_id: 1 },
      ],
    );

    expect(texto).toContain("STOCK TOTAL BARRA");
    expect(texto).toContain("\u{1F964} *GASEOSAS* · 6\nCoca Cola: 6");
    expect(texto).toContain("\u{1F37A} *CERVEZAS* · 4\nIPA: 4");
    // Lo que esta en 0 va al final, en "Sin stock".
    expect(texto.endsWith("*SIN STOCK*\nSprite")).toBe(true);
  });

  it("arma el encabezado con fecha y hora en 24 h", () => {
    const texto = formatWhatsappText(
      { categoriasOrdenadas: [], stockPorProducto: {} },
      [],
      new Date(2026, 10, 17, 21, 43),
    );

    expect(texto).toBe("\u{1F4CA} *STOCK TOTAL BARRA*\n17/11/2026 · 21:43");
  });

  it("elige el emoji de la categoria por su nombre y usa una caja si no lo reconoce", () => {
    expect(obtenerEmojiCategoria("Aguas saborizadas")).toBe("\u{1F34B}");
    expect(obtenerEmojiCategoria("Aguas")).toBe("\u{1F4A7}");
    expect(obtenerEmojiCategoria("Energéticas")).toBe("\u26A1");
    expect(obtenerEmojiCategoria("Sidras")).toBe("\u{1F34F}");
    expect(obtenerEmojiCategoria("Barriles (sin pinchar)")).toBe("\u{1F6E2}\uFE0F");
    expect(obtenerEmojiCategoria("Gin")).toBe("\u{1F378}");
    // "gin" solo como palabra entera: "Ginger ale" no es destilado.
    expect(obtenerEmojiCategoria("Ginger ale")).toBe("\u{1F4E6}");
    expect(obtenerEmojiCategoria("Snacks")).toBe("\u{1F4E6}");
  });

  it("formatea stock plano por categoria", () => {
    const texto = formatPlainText(
      {
        categoriasOrdenadas: [
          { id: 1, nombre: "Cervezas" },
          { id: 2, nombre: "Gaseosas" },
        ],
        stockPorProducto: {
          1: 2,
          2: 7,
        },
      },
      [
        { id: 1, nombre: "IPA", categoria_id: 1 },
        { id: 2, nombre: "Coca Cola", categoria_id: 2 },
      ],
    );

    expect(texto).toContain("CERVEZAS");
    expect(texto).toContain("IPA: 2");
    expect(texto).toContain("GASEOSAS");
    expect(texto).toContain("Coca Cola: 7");
  });

  it("formatea mensajes especiales cuando no hay comparacion o no hay cambios", () => {
    const productos = [{ id: 1, nombre: "IPA" }];

    expect(formatStockChanges([], productos)).toContain(
      "Todavía no hay dos capturas para comparar",
    );

    expect(
      formatStockChanges(
        [
          {
            producto_id: 1,
            actual: 5,
            anterior: 5,
            diferencia: 0,
            tipo: "sin_cambio",
          },
        ],
        productos,
      ),
    ).toContain("Sin cambios desde la última captura");
  });

  it("devuelve reporte vacio para entradas invalidas", () => {
    const reporte = buildStockChangesReport(null, null);

    expect(reporte).toEqual({
      tieneComparacion: false,
      hayCambios: false,
      snapshotActualFecha: null,
      snapshotAnteriorFecha: null,
      totalEntradas: 0,
      totalSalidas: 0,
      entradas: [],
      salidas: [],
      sinCambios: [],
      items: [],
    });
  });

  it("ordena empates alfabeticamente y buildStockChanges respeta el limite", () => {
    const diferencias = [
      { producto_id: 1, actual: 5, anterior: 2, diferencia: 3, tipo: "entrada" },
      { producto_id: 2, actual: 1, anterior: 4, diferencia: -3, tipo: "salida" },
      { producto_id: 3, actual: 9, anterior: 6, diferencia: 3, tipo: "entrada" },
    ];

    const productos = [
      { id: 1, nombre: "Zeta" },
      { id: 2, nombre: "Alpha" },
      { id: 3, nombre: "Beta" },
    ];

    const reporte = buildStockChangesReport(diferencias, productos);
    const cambios = buildStockChanges(diferencias, productos, 2);

    expect(reporte.items.map((item) => item.nombre)).toEqual([
      "Alpha",
      "Beta",
      "Zeta",
    ]);
    expect(cambios).toHaveLength(2);
    expect(cambios[0].magnitud).toBeGreaterThanOrEqual(cambios[1].magnitud);
  });
});
