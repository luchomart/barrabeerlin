import { normalizarTexto, redondearCantidad } from "../../utils/format.js";

// "¿Hay en stock?": busca un producto en todos los sectores y dice si hay, cuanto y donde.
// El dato es el del ultimo conteo de cada sector (las ventas todavia no descuentan solas).

export const LIMITE_RESULTADOS_CONSULTA = 30;

function fechaValida(valor) {
  if (!valor) return null;

  const fecha = new Date(valor);

  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

// Une catalogo e inventario: un item por producto con total, sectores con stock y ultimo conteo.
export function buildConsultaStock({ productos = [], sectores = [], inventario = [] } = {}) {
  const nombresSector = new Map(
    sectores.map((sector) => [String(sector.id), sector.nombre || `Sector ${sector.id}`]),
  );
  const porProducto = new Map();

  inventario.forEach((fila) => {
    const productoId = String(fila?.producto_id ?? "");
    const cantidad = Number(fila?.cantidad);

    if (!productoId || !Number.isFinite(cantidad)) return;

    if (!porProducto.has(productoId)) porProducto.set(productoId, []);
    porProducto.get(productoId).push({
      sector: nombresSector.get(String(fila.sector_id)) || "Otro sector",
      cantidad: redondearCantidad(cantidad),
      fecha: fechaValida(fila.ultima_actualizacion),
    });
  });

  return productos.map((producto) => {
    const filas = porProducto.get(String(producto.id)) || [];
    const conStock = filas
      .filter((fila) => fila.cantidad > 0)
      .sort((a, b) => b.cantidad - a.cantidad || a.sector.localeCompare(b.sector, "es"));
    const fechas = filas.map((fila) => fila.fecha).filter(Boolean);

    return {
      id: producto.id,
      nombre: producto.nombre || `Producto ${producto.id}`,
      nombreNormalizado: normalizarTexto(producto.nombre),
      total: redondearCantidad(conStock.reduce((suma, fila) => suma + fila.cantidad, 0)),
      sectores: conStock.map(({ sector, cantidad, fecha }) => ({ sector, cantidad, fecha })),
      ultimoConteo: fechas.length
        ? new Date(Math.max(...fechas.map((fecha) => fecha.getTime())))
        : null,
    };
  });
}

// Todas las palabras tienen que aparecer, en cualquier orden ("red ipa" encuentra "Red Ipa").
// Primero los que hay, despues alfabetico.
export function buscarEnConsulta(items = [], texto = "", limite = LIMITE_RESULTADOS_CONSULTA) {
  const palabras = normalizarTexto(texto).split(/\s+/).filter(Boolean);

  if (!palabras.length) return { resultados: [], cantidad: 0 };

  const coincidencias = items
    .filter((item) => palabras.every((palabra) => item.nombreNormalizado.includes(palabra)))
    .sort(
      (a, b) =>
        Number(b.total > 0) - Number(a.total > 0) || a.nombre.localeCompare(b.nombre, "es"),
    );

  return { resultados: coincidencias.slice(0, limite), cantidad: coincidencias.length };
}
