import { getInventarioTotal } from "./dataService.js";

const ORDEN_CATEGORIAS = [
  "gaseosa",
  "agua",
  "energ",
  "sabor",
  "vino",
  "espum",
  "destil",
];

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

export async function generarStockTotal(
  productos,
  categorias,
  modoWhatsapp = false,
) {
  const inventario = await getInventarioTotal();

  // =========================
  // ORDENAR CATEGORIAS
  // =========================

  const categoriasOrdenadas = [...categorias].sort((a, b) => {
    const nombreA = a.nombre.toLowerCase();
    const nombreB = b.nombre.toLowerCase();

    const posA = ORDEN_CATEGORIAS.findIndex((o) => nombreA.includes(o));
    const posB = ORDEN_CATEGORIAS.findIndex((o) => nombreB.includes(o));

    if (posA === -1) return 1;
    if (posB === -1) return -1;

    return posA - posB;
  });

  // -------------------------
  // SUMAR POR PRODUCTO
  // -------------------------

  const stockPorProducto = {};

  inventario.forEach((item) => {
    if (!stockPorProducto[item.producto_id]) {
      stockPorProducto[item.producto_id] = 0;
    }

    stockPorProducto[item.producto_id] += item.cantidad;
  });

  // -------------------------
  // FECHA Y HORA
  // -------------------------

  const ahora = new Date();

  const fecha = ahora.toLocaleDateString("es-AR");
  const hora = ahora.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // -------------------------
  // GENERAR TEXTO
  // -------------------------

  let texto = `📊 *STOCK TOTAL BARRA*
📅 ${fecha} - ${hora}

`;

  categoriasOrdenadas.forEach((categoria) => {
    const productosCategoria = productos.filter(
      (p) => Number(p.categoria_id) === Number(categoria.id),
    );

    if (productosCategoria.length === 0) return;

    let bloqueCategoria = "";

    productosCategoria.forEach((producto) => {
      const cantidad = stockPorProducto[producto.id] || 0;

      if (cantidad > 0) {
        bloqueCategoria += `• ${producto.nombre} — ${cantidad}\n`;
      }
    });

    if (bloqueCategoria !== "") {
      const emoji = obtenerEmojiCategoria(categoria.nombre);

      texto += `${emoji} ${categoria.nombre.toUpperCase()}\n`;
      texto += bloqueCategoria + "\n";
    }
  });

  // -------------------------
  // COPIAR AL PORTAPAPELES
  // -------------------------

  try {
    if (modoWhatsapp) {
      return texto;
    }

    try {
      await navigator.clipboard.writeText(texto);

      alert("📋 Stock copiado al portapapeles.");
    } catch {
      alert(texto);
    }
  } catch (error) {
    alert("No se pudo copiar automáticamente.\n\n" + texto);
  }
}
