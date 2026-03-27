import { supabase } from "./supabaseClient.js";

const db = supabase;

// =============================
// INVENTARIO SECTOR
// =============================

export async function getInventarioSector(sectorId) {
  const { data, error } = await db
    .from("inventario")
    .select("*")
    .eq("sector_id", sectorId);

  if (error) throw error;

  return data;
}

// =============================
// GUARDAR INVENTARIO
// =============================

export async function guardarInventario(registros) {
  const { error } = await db.from("inventario").upsert(registros, {
    onConflict: "producto_id,sector_id",
  });

  if (error) throw error;
}

// =============================
// INVENTARIO TOTAL
// =============================

export async function getInventarioTotal() {
  const { data, error } = await db
    .from("inventario")
    .select("producto_id, cantidad");

  if (error) throw error;

  return data;
}

// =============================
// CONTEOS DESDE FECHA
// =============================

export async function getConteosDesde(fechaIso) {
  const { data, error } = await db
    .from("inventario")
    .select(
      `
      empleado,
      sector_id,
      ultima_actualizacion,
      sectores(nombre)
    `,
    )
    .gte("ultima_actualizacion", fechaIso)
    .order("ultima_actualizacion", { ascending: false });

  if (error) throw error;

  return data;
}

// =============================
// INVENTARIO PARA SUPERVISOR
// =============================

export async function getInventarioConSectores() {
  const { data, error } = await db.from("inventario").select(`
      cantidad,
      producto_id,
      sectores(nombre)
    `);

  if (error) throw error;

  return data;
}

// =============================
// SNAPSHOT DE STOCK TOTAL
// =============================

export async function saveStockSnapshot(stockData) {
  const { stockPorProducto = {} } = stockData || {};
  const ahora = new Date();
  ahora.setMilliseconds(0);
  const fecha = ahora.toISOString();
  const snapshotPorProducto = new Map();

  Object.entries(stockPorProducto).forEach(([productoId, cantidad]) => {
    snapshotPorProducto.set(Number(productoId), {
      producto_id: Number(productoId),
      cantidad: Number(cantidad) || 0,
      fecha,
    });
  });

  const registros = Array.from(snapshotPorProducto.values());

  if (!registros.length) {
    return [];
  }

  const { data, error } = await db
    .from("stock_snapshots")
    .insert(registros)
    .select();

  if (error) throw error;

  return data;
}

// =============================
// DIFERENCIAS ENTRE SNAPSHOTS
// =============================

export async function getDiferenciasStock() {
  const { data: fechasData, error: fechasError } = await db
    .from("stock_snapshots")
    .select("fecha")
    .order("fecha", { ascending: false });

  if (fechasError) throw fechasError;

  if (!Array.isArray(fechasData) || !fechasData.length) {
    return [];
  }

  const ultimasFechas = [...new Set(fechasData.map((f) => f.fecha))].slice(0, 2);

  if (ultimasFechas.length < 2) {
    return [];
  }

  const [fechaActual, fechaAnterior] = ultimasFechas;

  const { data, error } = await db
    .from("stock_snapshots")
    .select("producto_id, cantidad, fecha")
    .in("fecha", [fechaActual, fechaAnterior]);

  if (error) throw error;

  const actual = {};
  const anterior = {};

  data.forEach((item) => {
    if (item.fecha === fechaActual) {
      actual[item.producto_id] = item.cantidad;
      return;
    }

    if (item.fecha === fechaAnterior) {
      anterior[item.producto_id] = item.cantidad;
    }
  });

  const productoIds = new Set([
    ...Object.keys(actual),
    ...Object.keys(anterior),
  ]);

  return Array.from(productoIds)
    .map((productoId) => {
      const cantidadActual = actual[productoId] || 0;
      const cantidadAnterior = anterior[productoId] || 0;

      return {
        producto_id: Number(productoId),
        actual: cantidadActual,
        anterior: cantidadAnterior,
        diferencia: cantidadActual - cantidadAnterior,
      };
    })
    .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));
}
