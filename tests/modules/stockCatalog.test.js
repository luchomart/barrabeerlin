import { describe, expect, it } from "vitest";

import {
  buildCatalogoRenderizable,
  buildCatalogoStockTotal,
  esProductoBarril,
  obtenerIdsCategoriasBarriles,
  obtenerProductosBarriles,
} from "../../js/modules/stock/stockCatalog.js";
import {
  CATEGORIA_VIRTUAL_BARRILES,
  NOMBRE_CATEGORIA_BARRILES,
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

  it("reconoce la categoria real de barriles sin importar mayusculas ni acentos", () => {
    expect(
      obtenerIdsCategoriasBarriles(
        [
          { id: 7, nombre: "Vinos" },
          { id: 26, nombre: " BARRILES " },
        ],
        NOMBRE_CATEGORIA_BARRILES,
      ),
    ).toEqual(["26"]);
    expect(obtenerIdsCategoriasBarriles([{ id: 1, nombre: "Barriles" }], "")).toEqual([]);
  });

  it("un barril nuevo en la categoria Barriles va solo a Camara aunque no este en la lista fija", () => {
    const categorias = [
      { id: 1, nombre: "Gaseosas" },
      { id: 26, nombre: "Barriles" },
    ];
    const productos = [
      { id: 10, nombre: "Coca Cola", categoria_id: 1 },
      { id: 100, nombre: "IPA", categoria_id: 26 },
      { id: 109, nombre: "Pale Ale Nueva", categoria_id: 26 },
    ];
    const idsCategoriasBarriles = obtenerIdsCategoriasBarriles(
      categorias,
      NOMBRE_CATEGORIA_BARRILES,
    );
    const base = {
      categorias,
      productos,
      ordenCategoriasSector: ORDEN_CATEGORIAS_SECTOR,
      categoriaVirtualBarriles: CATEGORIA_VIRTUAL_BARRILES,
      nombresBarrilesNormalizados,
      idsCategoriasBarriles,
    };

    expect(esProductoBarril(productos[2], nombresBarrilesNormalizados)).toBe(false);
    expect(
      esProductoBarril(productos[2], nombresBarrilesNormalizados, idsCategoriasBarriles),
    ).toBe(true);

    const camara = buildCatalogoRenderizable({ ...base, sectorNombre: "Camara" });
    expect(
      camara.productos
        .filter((producto) => producto.categoria_id === "barriles")
        .map((producto) => producto.nombre),
    ).toEqual(["IPA", "Pale Ale Nueva"]);

    const barra = buildCatalogoRenderizable({ ...base, sectorNombre: "Estantes Barra" });
    expect(barra.productos.map((producto) => producto.nombre)).toEqual(["Coca Cola"]);
  });

  it("el orden de categorias de Estante Cocina coincide con el sector real", () => {
    const resultado = buildCatalogoRenderizable({
      sectorNombre: "Estante Cocina",
      categorias: [
        { id: 1, nombre: "Gaseosas" },
        { id: 2, nombre: "Aguas" },
      ],
      productos: [],
      ordenCategoriasSector: ORDEN_CATEGORIAS_SECTOR,
      categoriaVirtualBarriles: CATEGORIA_VIRTUAL_BARRILES,
      nombresBarrilesNormalizados,
    });

    expect(resultado.categorias.map((categoria) => categoria.nombre)).toEqual([
      "Aguas",
      "Gaseosas",
    ]);
  });

  it("el catalogo del stock total incluye barriles sin importar el sector", () => {
    const { categorias, productos } = buildCatalogoStockTotal(
      [
        { id: 1, nombre: "Cervezas" },
        { id: 9, nombre: "Barriles" },
      ],
      [
        { id: 10, nombre: "Lata Stout", categoria_id: 1 },
        { id: 11, nombre: "Pale Ale", categoria_id: 9 },
        { id: 12, nombre: "IPA", categoria_id: 1 },
      ],
    );

    expect(categorias[0].id).toBe("barriles");
    expect(productos.map((producto) => [producto.nombre, producto.categoria_id])).toEqual([
      ["Lata Stout", 1],
      ["Pale Ale", "barriles"],
      ["IPA", "barriles"],
    ]);
  });
});
