import { describe, expect, it } from "vitest";

import {
  buildCatalogoRenderizable,
  esProductoBarril,
  obtenerProductosBarriles,
} from "../../js/modules/stock/stockCatalog.js";
import {
  CATEGORIA_VIRTUAL_BARRILES,
  ORDEN_CATEGORIAS_SECTOR,
  PRODUCTOS_BARRILES_CAMARA,
} from "../../js/config.js";
import { normalizarTexto } from "../../js/utils/format.js";

const nombresBarrilesNormalizados = PRODUCTOS_BARRILES_CAMARA.map((nombre) =>
  normalizarTexto(nombre),
);

describe("stockCatalog", () => {
  it("detecta productos de barril de forma robusta", () => {
    expect(
      esProductoBarril({ nombre: " Red Ipa " }, nombresBarrilesNormalizados),
    ).toBe(true);
    expect(
      esProductoBarril({ nombre: "SESSION IPA" }, nombresBarrilesNormalizados),
    ).toBe(true);
    expect(
      esProductoBarril({ nombre: "Fernet" }, nombresBarrilesNormalizados),
    ).toBe(false);
  });

  it("obtiene solo barriles del catalogo", () => {
    const productos = [
      { id: 1, nombre: "IPA" },
      { id: 2, nombre: "Red Ipa" },
      { id: 3, nombre: "Fernet" },
    ];

    expect(
      obtenerProductosBarriles(productos, nombresBarrilesNormalizados).map(
        (producto) => producto.nombre,
      ),
    ).toEqual(["IPA", "Red Ipa"]);
  });

  it("en Camara crea categoria virtual y reagrupa barriles sin mutar origen", () => {
    const categorias = [
      { id: 1, nombre: "Cervezas" },
      { id: 2, nombre: "Gaseosas" },
      { id: 3, nombre: "Vinos" },
    ];
    const productos = [
      { id: 10, nombre: "IPA", categoria_id: 1 },
      { id: 11, nombre: "Red Ipa", categoria_id: 1 },
      { id: 12, nombre: "Coca Cola", categoria_id: 2 },
      { id: 13, nombre: "Malbec", categoria_id: 3 },
    ];

    const resultado = buildCatalogoRenderizable({
      sectorNombre: "Cámara",
      categorias,
      productos,
      ordenCategoriasSector: ORDEN_CATEGORIAS_SECTOR,
      categoriaVirtualBarriles: CATEGORIA_VIRTUAL_BARRILES,
      nombresBarrilesNormalizados,
    });

    expect(resultado.esCamara).toBe(true);
    expect(resultado.sinBarrilesConfigurados).toBe(false);
    expect(resultado.categorias[0]).toEqual(CATEGORIA_VIRTUAL_BARRILES);
    expect(resultado.productos.filter((producto) => producto.categoria_id === "barriles")).toEqual([
      { id: 10, nombre: "IPA", categoria_id: "barriles" },
      { id: 11, nombre: "Red Ipa", categoria_id: "barriles" },
    ]);
    expect(productos).toEqual([
      { id: 10, nombre: "IPA", categoria_id: 1 },
      { id: 11, nombre: "Red Ipa", categoria_id: 1 },
      { id: 12, nombre: "Coca Cola", categoria_id: 2 },
      { id: 13, nombre: "Malbec", categoria_id: 3 },
    ]);
  });

  it("fuera de Camara elimina barriles y conserva orden de categorias por sector", () => {
    const categorias = [
      { id: 1, nombre: "Cervezas" },
      { id: 2, nombre: "Gaseosas" },
      { id: 3, nombre: "Aguas" },
      { id: 4, nombre: "Destilados, licores y aperitivos" },
    ];
    const productos = [
      { id: 10, nombre: "IPA", categoria_id: 1 },
      { id: 11, nombre: "Coca Cola", categoria_id: 2 },
      { id: 12, nombre: "Agua", categoria_id: 3 },
      { id: 13, nombre: "Gin", categoria_id: 4 },
    ];

    const resultado = buildCatalogoRenderizable({
      sectorNombre: "Estantes Barra",
      categorias,
      productos,
      ordenCategoriasSector: ORDEN_CATEGORIAS_SECTOR,
      categoriaVirtualBarriles: CATEGORIA_VIRTUAL_BARRILES,
      nombresBarrilesNormalizados,
    });

    expect(resultado.esCamara).toBe(false);
    expect(resultado.sinBarrilesConfigurados).toBe(false);
    expect(resultado.productos.map((producto) => producto.nombre)).toEqual([
      "Coca Cola",
      "Agua",
      "Gin",
    ]);
    expect(resultado.categorias.map((categoria) => categoria.nombre)).toEqual([
      "Destilados, licores y aperitivos",
      "Aguas",
      "Cervezas",
      "Gaseosas",
    ]);
  });

  it("marca advertencia logica cuando Camara no tiene barriles configurados", () => {
    const resultado = buildCatalogoRenderizable({
      sectorNombre: "Camara",
      categorias: [{ id: 1, nombre: "Cervezas" }],
      productos: [{ id: 20, nombre: "Fernet", categoria_id: 1 }],
      ordenCategoriasSector: ORDEN_CATEGORIAS_SECTOR,
      categoriaVirtualBarriles: CATEGORIA_VIRTUAL_BARRILES,
      nombresBarrilesNormalizados,
    });

    expect(resultado.esCamara).toBe(true);
    expect(resultado.sinBarrilesConfigurados).toBe(true);
  });
});
