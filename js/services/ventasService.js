import { supabase } from "./supabaseClient.js";

const db = supabase;
const CANTIDAD_MAXIMA_VENTA = 1000;

function esProductoIdValido(valor) {
  return Number.isInteger(valor) && valor > 0;
}

export function normalizarCantidadVenta(valor) {
  const cantidad = Number(valor);

  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    return 0;
  }

  return Math.min(CANTIDAD_MAXIMA_VENTA, Math.trunc(cantidad));
}

export function normalizarStockVendido(stockVendido = {}) {
  if (!stockVendido || typeof stockVendido !== "object") {
    return {};
  }

  return Object.entries(stockVendido).reduce((acumulado, [productoId, cantidad]) => {
    const productoIdNormalizado = Number(productoId);
    const cantidadNormalizada = normalizarCantidadVenta(cantidad);

    if (!esProductoIdValido(productoIdNormalizado) || cantidadNormalizada <= 0) {
      return acumulado;
    }

    acumulado[productoIdNormalizado] = cantidadNormalizada;

    return acumulado;
  }, {});
}

function normalizarDetalleVenta(detalle = {}) {
  return {
    producto_id: Number(detalle.producto_id),
    cantidad: normalizarCantidadVenta(detalle.cantidad),
    descontado: Math.max(0, Math.trunc(Number(detalle.descontado) || 0)),
    faltante: Math.max(0, Math.trunc(Number(detalle.faltante) || 0)),
  };
}

function normalizarDescuentoVenta(descuento = {}) {
  return {
    producto_id: Number(descuento.producto_id),
    sector_id: String(descuento.sector_id || ""),
    sector_nombre: String(descuento.sector_nombre || ""),
    cantidad_descontada: Math.max(
      0,
      Math.trunc(Number(descuento.cantidad_descontada) || 0),
    ),
    prioridad: Math.max(0, Math.trunc(Number(descuento.prioridad) || 0)),
  };
}

export function normalizarResultadoVenta(resultado = {}) {
  const detalles = Array.isArray(resultado.detalles)
    ? resultado.detalles.map(normalizarDetalleVenta)
    : [];
  const descuentos = Array.isArray(resultado.descuentos)
    ? resultado.descuentos.map(normalizarDescuentoVenta)
    : [];

  return {
    status: resultado.status || "invalid",
    venta_id: resultado.venta_id || null,
    detalles,
    descuentos,
  };
}

export async function registrarVenta({
  stockVendido,
  empleado = "",
  observacion = "",
} = {}) {
  const stockNormalizado = normalizarStockVendido(stockVendido);

  if (!Object.keys(stockNormalizado).length) {
    return {
      status: "empty",
      venta_id: null,
      detalles: [],
      descuentos: [],
    };
  }

  const { data, error } = await db.rpc("registrar_venta", {
    stock_vendido: stockNormalizado,
    empleado: String(empleado || "").trim() || null,
    observacion: String(observacion || "").trim() || null,
  });

  if (error) throw error;

  return normalizarResultadoVenta(data);
}
