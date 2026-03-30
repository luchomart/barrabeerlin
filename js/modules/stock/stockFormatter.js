import { getInventarioTotal } from "../../services/inventarioService.js";

const ORDEN_CATEGORIAS = [
  "gaseosa",
  "agua",
  "energ",
  "sabor",
  "vino",
  "espum",
  "destil",
];

const ICONOS = {
  agua: "\u{1F4A7}",
  aguaSaborizada: "\u{1F34B}",
  baja: "\u{1F4C9}",
  brillos: "\u{1F37E}",
  cerveza: "\u{1F37A}",
  destilados: "\u{1F378}",
  energia: "\u26A1",
  grafico: "\u{1F4CA}",
  suba: "\u{1F4C8}",
  vino: "\u{1F377}",
  gaseosa: "\u{1F964}",
  default: "\u2022",
};

function obtenerEmojiCategoria(nombreCategoria = "") {
  const nombre = String(nombreCategoria).toLowerCase();

  if (nombre.includes("gaseosa")) return ICONOS.gaseosa;
  if (nombre.includes("agua") && nombre.includes("sabor")) {
    return ICONOS.aguaSaborizada;
  }
  if (nombre.includes("agua")) return ICONOS.agua;
  if (nombre.includes("energ")) return ICONOS.energia;
  if (nombre.includes("vino")) return ICONOS.vino;
  if (nombre.includes("espum")) return ICONOS.brillos;
  if (nombre.includes("destil") || nombre.includes("licor")) {
    return ICONOS.destilados;
  }
  if (nombre.includes("cerveza")) return ICONOS.cerveza;

  return ICONOS.default;
}

function ordenarCategorias(categorias = []) {
  return [...categorias].sort((a, b) => {
    const nombreA = String(a?.nombre || "").toLowerCase();
    const nombreB = String(b?.nombre || "").toLowerCase();

    const posA = ORDEN_CATEGORIAS.findIndex((orden) => nombreA.includes(orden));
    const posB = ORDEN_CATEGORIAS.findIndex((orden) => nombreB.includes(orden));

    if (posA === -1) return 1;
    if (posB === -1) return -1;

    return posA - posB;
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

  return {
    tieneComparacion: items.length > 0,
    hayCambios: entradas.length > 0 || salidas.length > 0,
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

export function formatWhatsappText(data, productos) {
  const { categoriasOrdenadas = [], stockPorProducto = {} } = data || {};

  const ahora = new Date();
  const fecha = ahora.toLocaleDateString("es-AR");
  const hora = ahora.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  let texto = `${ICONOS.grafico} *STOCK TOTAL BARRA*\n${ICONOS.default} ${fecha} - ${hora}\n\n`;

  categoriasOrdenadas.forEach((categoria) => {
    const productosCategoria = productos.filter(
      (producto) => perteneceACategoria(producto, categoria),
    );

    let bloque = "";

    productosCategoria.forEach((producto) => {
      const cantidad = Number(stockPorProducto[producto.id]) || 0;

      if (cantidad > 0) {
        bloque += `- ${producto.nombre}: ${cantidad}\n`;
      }
    });

    if (bloque) {
      const emoji = obtenerEmojiCategoria(categoria.nombre);

      texto += `${emoji} ${String(categoria.nombre || "").toUpperCase()}\n`;
      texto += `${bloque}\n`;
    }
  });

  return texto.trim();
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
    return `${ICONOS.grafico} CAMBIOS DE STOCK (GLOBAL)\n\nTodavia no hay dos snapshots para comparar`;
  }

  if (!reporte.hayCambios) {
    return `${ICONOS.grafico} CAMBIOS DE STOCK (GLOBAL)\n\nSin cambios desde el ultimo conteo`;
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
