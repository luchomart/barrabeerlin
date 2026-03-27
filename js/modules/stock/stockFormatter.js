import { getInventarioTotal } from "../../services/inventarioService.js";

// =============================
// ORDEN DE CATEGORIAS
// =============================

const ORDEN_CATEGORIAS = [
  "gaseosa",
  "agua",
  "energ",
  "sabor",
  "vino",
  "espum",
  "destil",
];

// =============================
// EMOJIS
// =============================

function obtenerEmojiCategoria(nombreCategoria) {
  const nombre = nombreCategoria.toLowerCase();

  if (nombre.includes("gaseosa")) return "🥤";
  if (nombre.includes("agua") && nombre.includes("sabor")) return "🍋";
  if (nombre.includes("agua")) return "💧";
  if (nombre.includes("energ")) return "⚡";
  if (nombre.includes("vino")) return "🍷";
  if (nombre.includes("espum")) return "🍾";
  if (nombre.includes("destil") || nombre.includes("licor")) return "🍸";
  if (nombre.includes("cerveza")) return "🍺";

  return "•";
}

// =============================
// BUILD DATA (LOGICA PURA)
// =============================

export async function buildStockData(productos, categorias) {
  const inventario = await getInventarioTotal();

  const categoriasOrdenadas = [...categorias].sort((a, b) => {
    const nombreA = a.nombre.toLowerCase();
    const nombreB = b.nombre.toLowerCase();

    const posA = ORDEN_CATEGORIAS.findIndex((orden) =>
      nombreA.includes(orden),
    );
    const posB = ORDEN_CATEGORIAS.findIndex((orden) =>
      nombreB.includes(orden),
    );

    if (posA === -1) return 1;
    if (posB === -1) return -1;

    return posA - posB;
  });

  const stockPorProducto = {};

  inventario.forEach((item) => {
    if (!stockPorProducto[item.producto_id]) {
      stockPorProducto[item.producto_id] = 0;
    }

    stockPorProducto[item.producto_id] += item.cantidad;
  });

  return {
    categoriasOrdenadas,
    stockPorProducto,
  };
}

// =============================
// FORMATO WHATSAPP
// =============================

export function formatWhatsappText(data, productos) {
  const { categoriasOrdenadas, stockPorProducto } = data;

  const ahora = new Date();

  const fecha = ahora.toLocaleDateString("es-AR");
  const hora = ahora.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  let texto = `📊 *STOCK TOTAL BARRA*\n📅 ${fecha} - ${hora}\n\n`;

  categoriasOrdenadas.forEach((categoria) => {
    const productosCategoria = productos.filter(
      (producto) => Number(producto.categoria_id) === Number(categoria.id),
    );

    let bloque = "";

    productosCategoria.forEach((producto) => {
      const cantidad = stockPorProducto[producto.id] || 0;

      if (cantidad > 0) {
        bloque += `• ${producto.nombre} — ${cantidad}\n`;
      }
    });

    if (bloque) {
      const emoji = obtenerEmojiCategoria(categoria.nombre);

      texto += `${emoji} ${categoria.nombre.toUpperCase()}\n`;
      texto += bloque + "\n";
    }
  });

  return texto;
}

// =============================
// FORMATO SIMPLE (SUPERVISOR)
// =============================

export function formatPlainText(data, productos) {
  const { categoriasOrdenadas, stockPorProducto } = data;

  let texto = "";

  categoriasOrdenadas.forEach((categoria) => {
    const productosCategoria = productos.filter(
      (producto) => Number(producto.categoria_id) === Number(categoria.id),
    );

    let bloque = "";

    productosCategoria.forEach((producto) => {
      const cantidad = stockPorProducto[producto.id] || 0;

      if (cantidad > 0) {
        bloque += `${producto.nombre}: ${cantidad}\n`;
      }
    });

    if (bloque) {
      texto += `${categoria.nombre.toUpperCase()}\n`;
      texto += bloque + "\n";
    }
  });

  return texto;
}

// =============================
// FORMATO DE CAMBIOS
// =============================

export function formatStockChanges(diferencias, productos) {
  if (!Array.isArray(diferencias) || !Array.isArray(productos)) {
    return "📉 CAMBIOS DE STOCK\n\nSin cambios";
  }

  const nombresPorProducto = {};

  productos.forEach((producto) => {
    nombresPorProducto[producto.id] = producto.nombre;
  });

  const cambios = diferencias
    .filter((item) => item && item.diferencia !== 0)
    .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))
    .slice(0, 10);

  if (!cambios.length) {
    return "📉 CAMBIOS DE STOCK\n\nSin cambios";
  }

  let texto = "📉 CAMBIOS DE STOCK\n\n";

  cambios.forEach((item) => {
    const nombre =
      nombresPorProducto[item.producto_id] || `Producto ${item.producto_id}`;
    const icono = item.diferencia > 0 ? "📈" : "📉";
    const signo = item.diferencia > 0 ? "+" : "";

    texto += `${icono} ${nombre}: ${signo}${item.diferencia}\n`;
  });

  return texto.trim();
}
