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

export function buildStockChanges(diferencias, productos, limit = 10) {
  if (!Array.isArray(diferencias) || !Array.isArray(productos)) {
    return [];
  }

  const nombresPorProducto = construirMapaProductos(productos);

  return diferencias
    .map((item) => {
      const productoId = Number(item?.producto_id);
      const actual = Number(item?.actual) || 0;
      const anterior = Number(item?.anterior) || 0;
      const diferencia = Number(item?.diferencia) || 0;

      return {
        producto_id: productoId,
        actual,
        anterior,
        diferencia,
        esSuba: diferencia > 0,
        icono: diferencia > 0 ? ICONOS.suba : ICONOS.baja,
        nombre:
          nombresPorProducto[productoId] ||
          `Producto ${Number.isFinite(productoId) ? productoId : "sin id"}`,
      };
    })
    .filter((item) => Number.isFinite(item.producto_id) && item.diferencia !== 0)
    .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))
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
      (producto) => Number(producto.categoria_id) === Number(categoria.id),
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
      (producto) => Number(producto.categoria_id) === Number(categoria.id),
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
  const cambios = buildStockChanges(diferencias, productos);

  if (!cambios.length) {
    return `${ICONOS.baja} CAMBIOS DE STOCK\n\nSin cambios`;
  }

  let texto = `${ICONOS.baja} CAMBIOS DE STOCK\n\n`;

  cambios.forEach((item) => {
    const signo = item.diferencia > 0 ? "+" : "";

    texto += `${item.icono} ${item.nombre}: ${signo}${item.diferencia}\n`;
  });

  return texto.trim();
}
