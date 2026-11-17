import { getInventarioTotal } from "../../services/inventarioService.js";

import { normalizarTexto } from "../../utils/format.js";

// Orden de las categorias en los mensajes (por palabra, sin tildes). Las que no estan
// en la lista van antes de los barriles, por nombre.
const ORDEN_CATEGORIAS = [
  "gaseosa",
  "agua",
  "energ",
  "sabor",
  "cerveza",
  "sidra",
  "vino",
  "espum",
  "destil",
  "barril",
];

const ICONOS = {
  agua: "\u{1F4A7}",
  aguaSaborizada: "\u{1F34B}",
  baja: "\u{1F4C9}",
  barril: "\u{1F6E2}\uFE0F",
  brillos: "\u{1F37E}",
  cafe: "\u2615",
  cerveza: "\u{1F37A}",
  destilados: "\u{1F378}",
  energia: "\u26A1",
  grafico: "\u{1F4CA}",
  hielo: "\u{1F9CA}",
  jugo: "\u{1F9C3}",
  sidra: "\u{1F34F}",
  sinStock: "\u26A0\uFE0F",
  suba: "\u{1F4C8}",
  vino: "\u{1F377}",
  whisky: "\u{1F943}",
  gaseosa: "\u{1F964}",
  default: "\u{1F4E6}",
};

// El emoji sale del nombre de la categoria; si no se reconoce ninguna palabra, una caja.
const EMOJIS_POR_PALABRA = [
  [["barril"], ICONOS.barril],
  [["gaseosa"], ICONOS.gaseosa],
  [["sabor"], ICONOS.aguaSaborizada],
  [["agua"], ICONOS.agua],
  [["energ"], ICONOS.energia],
  [["cerveza", "birra"], ICONOS.cerveza],
  [["sidra"], ICONOS.sidra],
  [["espum", "champ"], ICONOS.brillos],
  [["vino"], ICONOS.vino],
  [["whisk", "ron", "vodka", "tequila", "fernet"], ICONOS.whisky],
  [["destil", "licor", "aperit", "gin"], ICONOS.destilados],
  [["jugo"], ICONOS.jugo],
  [["cafe"], ICONOS.cafe],
  [["hielo"], ICONOS.hielo],
];

export function obtenerEmojiCategoria(nombreCategoria = "") {
  const nombre = normalizarTexto(String(nombreCategoria));
  const palabras = nombre.split(/[^a-z0-9]+/).filter(Boolean);
  const encontrado = EMOJIS_POR_PALABRA.find(([claves]) =>
    claves.some((clave) =>
      // Las claves cortas ("ron", "gin") tienen que ser palabra entera.
      clave.length <= 3
        ? palabras.includes(clave)
        : palabras.some((palabra) => palabra.startsWith(clave) || palabra.includes(clave)),
    ),
  );

  return encontrado ? encontrado[1] : ICONOS.default;
}

function posicionCategoria(nombre) {
  const normalizado = normalizarTexto(nombre);
  const posicion = ORDEN_CATEGORIAS.findIndex((orden) => normalizado.includes(orden));

  // Las desconocidas van justo antes de los barriles.
  return posicion === -1 ? ORDEN_CATEGORIAS.indexOf("barril") - 0.5 : posicion;
}

function ordenarCategorias(categorias = []) {
  return [...categorias].sort((a, b) => {
    const diferencia = posicionCategoria(a?.nombre) - posicionCategoria(b?.nombre);

    if (diferencia !== 0) return diferencia;

    return String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es");
  });
}

function construirStockPorProducto(inventario = []) {
  return inventario.reduce((acumulado, item) => {
    const productoId = Number(item?.producto_id);
    const cantidad = Number(item?.cantidad);

    if (!Number.isFinite(productoId)) {
      return acumulado;
    }

    if (!Number.isFinite(cantidad)) {
      return acumulado;
    }

    if (!acumulado[productoId]) {
      acumulado[productoId] = 0;
    }

    acumulado[productoId] += cantidad;

    return acumulado;
  }, {});
}

function construirMapaProductos(productos = []) {
  return productos.reduce((acumulado, producto) => {
    const productoId = Number(producto?.id);

    if (!Number.isFinite(productoId)) {
      return acumulado;
    }

    acumulado[productoId] = producto.nombre || `Producto ${productoId}`;

    return acumulado;
  }, {});
}

function perteneceACategoria(producto, categoria) {
  return String(producto?.categoria_id) === String(categoria?.id);
}

function resolverTipoCambio(diferencia, tipo) {
  if (tipo === "entrada" || tipo === "salida" || tipo === "sin_cambio") {
    return tipo;
  }

  if (diferencia > 0) return "entrada";
  if (diferencia < 0) return "salida";

  return "sin_cambio";
}

function enriquecerCambioStock(item, nombresPorProducto) {
  const productoId = Number(item?.producto_id);
  const actual = Number(item?.actual) || 0;
  const anterior = Number(item?.anterior) || 0;
  const diferencia = Number(item?.diferencia) || 0;
  const tipo = resolverTipoCambio(diferencia, item?.tipo);

  return {
    producto_id: productoId,
    actual,
    anterior,
    diferencia,
    snapshot_actual_fecha: item?.snapshot_actual_fecha || null,
    snapshot_anterior_fecha: item?.snapshot_anterior_fecha || null,
    tipo,
    magnitud: Math.abs(diferencia),
    esSuba: tipo === "entrada",
    icono:
      tipo === "entrada"
        ? ICONOS.suba
        : tipo === "salida"
          ? ICONOS.baja
          : "\u2696\uFE0F",
    nombre:
      nombresPorProducto[productoId] ||
      `Producto ${Number.isFinite(productoId) ? productoId : "sin id"}`,
  };
}

export function buildStockDataFromInventario(
  inventario = [],
  productos = [],
  categorias = [],
) {
  return {
    categoriasOrdenadas: ordenarCategorias(categorias),
    stockPorProducto: construirStockPorProducto(inventario),
    productos,
  };
}

// Wrapper async para obtener inventario real sin cambiar la API actual.
export async function buildStockData(productos, categorias) {
  const inventario = await getInventarioTotal();

  return buildStockDataFromInventario(inventario, productos, categorias);
}

export function buildStockChangesReport(
  diferencias,
  productos,
  limit = 10,
) {
  const reporteVacio = {
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
  };

  if (!Array.isArray(diferencias) || !Array.isArray(productos)) {
    return reporteVacio;
  }

  const nombresPorProducto = construirMapaProductos(productos);
  const items = diferencias
    .map((item) => enriquecerCambioStock(item, nombresPorProducto))
    .filter((item) => Number.isFinite(item.producto_id))
    .sort((a, b) => {
      if (b.magnitud !== a.magnitud) {
        return b.magnitud - a.magnitud;
      }

      return String(a.nombre).localeCompare(String(b.nombre), "es");
    });

  const entradas = items.filter((item) => item.tipo === "entrada");
  const salidas = items.filter((item) => item.tipo === "salida");
  const sinCambios = items.filter((item) => item.tipo === "sin_cambio");
  const primerItem = items[0] || {};

  return {
    tieneComparacion: items.length > 0,
    hayCambios: entradas.length > 0 || salidas.length > 0,
    snapshotActualFecha: primerItem.snapshot_actual_fecha || null,
    snapshotAnteriorFecha: primerItem.snapshot_anterior_fecha || null,
    totalEntradas: entradas.reduce(
      (acumulado, item) => acumulado + item.diferencia,
      0,
    ),
    totalSalidas: salidas.reduce(
      (acumulado, item) => acumulado + item.diferencia,
      0,
    ),
    entradas: entradas.slice(0, limit),
    salidas: salidas.slice(0, limit),
    sinCambios: sinCambios.slice(0, limit),
    items,
  };
}

export function buildStockChanges(diferencias, productos, limit = 10) {
  const reporte = buildStockChangesReport(diferencias, productos, limit);

  return [...reporte.salidas, ...reporte.entradas]
    .sort((a, b) => b.magnitud - a.magnitud)
    .slice(0, limit);
}

function formatearFechaHora(fecha = new Date()) {
  const dia = fecha.toLocaleDateString("es-AR");
  const hora = fecha.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${dia} · ${hora}`;
}

// Mensaje del stock total para WhatsApp: categorias con su total, productos con stock
// y al final los que estan en 0 (para reponer).
export function formatWhatsappText(data, productos = [], fecha = new Date()) {
  const { categoriasOrdenadas = [], stockPorProducto = {} } = data || {};
  const listaProductos = Array.isArray(productos) ? productos : [];
  const bloques = [];
  const sinStock = [];

  categoriasOrdenadas.forEach((categoria) => {
    const productosCategoria = listaProductos.filter((producto) =>
      perteneceACategoria(producto, categoria),
    );

    const lineas = [];
    let total = 0;

    productosCategoria.forEach((producto) => {
      const cantidad = Number(stockPorProducto[producto.id]) || 0;

      if (cantidad > 0) {
        lineas.push(`${producto.nombre}: ${cantidad}`);
        total += cantidad;
      } else {
        sinStock.push(producto.nombre);
      }
    });

    if (lineas.length) {
      const emoji = obtenerEmojiCategoria(categoria.nombre);
      const titulo = String(categoria.nombre || "").toUpperCase();

      bloques.push(`${emoji} *${titulo}* · ${total}\n${lineas.join("\n")}`);
    }
  });

  if (sinStock.length) {
    bloques.push(`${ICONOS.sinStock} *SIN STOCK*\n${sinStock.join("\n")}`);
  }

  const encabezado = `${ICONOS.grafico} *STOCK TOTAL BARRA*\n${formatearFechaHora(fecha)}`;

  return [encabezado, ...bloques].join("\n\n");
}

export function formatPlainText(data, productos) {
  const { categoriasOrdenadas = [], stockPorProducto = {} } = data || {};

  let texto = "";

  categoriasOrdenadas.forEach((categoria) => {
    const productosCategoria = productos.filter(
      (producto) => perteneceACategoria(producto, categoria),
    );

    let bloque = "";

    productosCategoria.forEach((producto) => {
      const cantidad = Number(stockPorProducto[producto.id]) || 0;

      if (cantidad > 0) {
        bloque += `${producto.nombre}: ${cantidad}\n`;
      }
    });

    if (bloque) {
      texto += `${String(categoria.nombre || "").toUpperCase()}\n`;
      texto += `${bloque}\n`;
    }
  });

  return texto.trim();
}

export function formatStockChanges(diferencias, productos) {
  const reporte = buildStockChangesReport(diferencias, productos);
  const bloques = [];

  if (!reporte.tieneComparacion) {
    return `${ICONOS.grafico} CAMBIOS DE STOCK (GLOBAL)\n\nTodavía no hay dos capturas para comparar`;
  }

  if (!reporte.hayCambios) {
    return `${ICONOS.grafico} CAMBIOS DE STOCK (GLOBAL)\n\nSin cambios desde la última captura`;
  }

  if (reporte.salidas.length) {
    const lineas = reporte.salidas.map(
      (item) => `- ${item.nombre}: ${item.diferencia}`,
    );

    bloques.push(`\u2B07\uFE0F SALIDAS:\n${lineas.join("\n")}`);
  }

  if (reporte.entradas.length) {
    const lineas = reporte.entradas.map(
      (item) => `- ${item.nombre}: +${item.diferencia}`,
    );

    bloques.push(`\u2B06\uFE0F ENTRADAS:\n${lineas.join("\n")}`);
  }

  if (reporte.sinCambios.length) {
    const lineas = reporte.sinCambios.map((item) => `- ${item.nombre}`);

    bloques.push(`\u2696\uFE0F SIN CAMBIOS:\n${lineas.join("\n")}`);
  }

  return `${ICONOS.grafico} CAMBIOS DE STOCK (GLOBAL)\n\n${bloques.join("\n\n")}`.trim();
}
