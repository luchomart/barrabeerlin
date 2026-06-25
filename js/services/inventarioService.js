import { supabase } from "./supabaseClient.js";

const db = supabase;

const SNAPSHOT_DEDUP_WINDOW_MS = 10000;
const SNAPSHOT_PAGE_SIZE = 250;

function esProductoIdValido(valor) {
  return Number.isInteger(valor) && valor > 0;
}

function normalizarCantidadSnapshot(valor) {
  const cantidad = Number(valor);

  if (!Number.isFinite(cantidad)) {
    return 0;
  }

  if (cantidad < 0) {
    return 0;
  }

  return Math.trunc(cantidad);
}

function normalizarRegistrosSnapshot(stockPorProducto = {}) {
  return Object.entries(stockPorProducto).reduce((acumulado, [productoId, cantidad]) => {
    const productoIdNormalizado = Number(productoId);

    if (!esProductoIdValido(productoIdNormalizado)) {
      return acumulado;
    }

    acumulado.push({
      producto_id: productoIdNormalizado,
      cantidad: normalizarCantidadSnapshot(cantidad),
    });

    return acumulado;
  }, []);
}

function normalizarRowsSnapshot(rows = []) {
  return rows
    .map((row) => ({
      producto_id: Number(row?.producto_id),
      cantidad: normalizarCantidadSnapshot(row?.cantidad),
    }))
    .filter((row) => esProductoIdValido(row.producto_id))
    .sort((a, b) => a.producto_id - b.producto_id);
}

function construirFingerprintSnapshot(rows = []) {
  return normalizarRowsSnapshot(rows)
    .map((row) => `${row.producto_id}:${row.cantidad}`)
    .join("|");
}

function construirResumenSnapshot(rows = [], fecha = null) {
  const normalizados = normalizarRowsSnapshot(rows);

  return {
    fecha: fecha || null,
    totalProductos: normalizados.length,
    totalUnidades: normalizados.reduce(
      (acumulado, row) => acumulado + row.cantidad,
      0,
    ),
    fingerprint: construirFingerprintSnapshot(normalizados),
  };
}

function snapshotsSonIguales(snapshotA = [], snapshotB = []) {
  const a = normalizarRowsSnapshot(snapshotA);
  const b = normalizarRowsSnapshot(snapshotB);

  if (a.length !== b.length) {
    return false;
  }

  return a.every((item, index) => {
    const comparado = b[index];

    return (
      item.producto_id === comparado.producto_id &&
      item.cantidad === comparado.cantidad
    );
  });
}

function esSnapshotReciente(fechaIso) {
  const fecha = new Date(fechaIso);
  const timestamp = fecha.getTime();

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  return Date.now() - timestamp <= SNAPSHOT_DEDUP_WINDOW_MS;
}

async function getUltimasFechasSnapshot(cantidad = 2) {
  const fechas = [];
  const vistas = new Set();
  let desde = 0;

  while (fechas.length < cantidad) {
    const hasta = desde + SNAPSHOT_PAGE_SIZE - 1;
    const { data, error } = await db
      .from("stock_snapshots")
      .select("fecha")
      .order("fecha", { ascending: false })
      .range(desde, hasta);

    if (error) throw error;

    if (!Array.isArray(data) || !data.length) {
      break;
    }

    data.forEach((item) => {
      const fecha = item?.fecha;

      if (!fecha || vistas.has(fecha) || fechas.length >= cantidad) {
        return;
      }

      vistas.add(fecha);
      fechas.push(fecha);
    });

    if (data.length < SNAPSHOT_PAGE_SIZE) {
      break;
    }

    desde += SNAPSHOT_PAGE_SIZE;
  }

  return fechas;
}

async function getSnapshotByFecha(fecha) {
  if (!fecha) {
    return [];
  }

  const { data, error } = await db
    .from("stock_snapshots")
    .select("producto_id, cantidad, fecha")
    .eq("fecha", fecha);

  if (error) throw error;

  return Array.isArray(data) ? data : [];
}

async function getSnapshotsRecientes(cantidad = 2) {
  const fechas = await getUltimasFechasSnapshot(cantidad);

  if (!fechas.length) {
    return [];
  }

  const snapshots = await Promise.all(
    fechas.map(async (fecha) => {
      const rows = await getSnapshotByFecha(fecha);

      return {
        fecha,
        rows,
        resumen: construirResumenSnapshot(rows, fecha),
      };
    }),
  );

  return snapshots.filter((snapshot) => snapshot.rows.length > 0);
}

export async function getInventarioSector(sectorId) {
  const { data, error } = await db
    .from("inventario")
    .select("*")
    .eq("sector_id", sectorId);

  if (error) throw error;

  return data;
}

export async function guardarInventario(registros) {
  const { error } = await db.from("inventario").upsert(registros, {
    onConflict: "producto_id,sector_id",
  });

  if (error) throw error;
}

export async function getInventarioTotal() {
  const { data, error } = await db
    .from("inventario")
    .select("producto_id, cantidad");

  if (error) throw error;

  return data;
}

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

export async function getInventarioConSectores() {
  const { data, error } = await db.from("inventario").select(`
      cantidad,
      producto_id,
      sectores(nombre)
    `);

  if (error) throw error;

  return data;
}

export async function saveStockSnapshot(stockData) {
  const stockPorProducto = stockData?.stockPorProducto;

  if (!stockPorProducto || typeof stockPorProducto !== "object") {
    return {
      status: "invalid",
      fecha: null,
      registros: [],
      resumen: null,
    };
  }

  const registrosBase = normalizarRegistrosSnapshot(stockPorProducto);
  const resumenBase = construirResumenSnapshot(registrosBase);

  if (!registrosBase.length) {
    return {
      status: "empty",
      fecha: null,
      registros: [],
      resumen: resumenBase,
    };
  }

  const [ultimoSnapshot] = await getSnapshotsRecientes(1);

  if (ultimoSnapshot) {
    if (
      esSnapshotReciente(ultimoSnapshot.fecha) &&
      snapshotsSonIguales(registrosBase, ultimoSnapshot.rows)
    ) {
      return {
        status: "deduplicated",
        fecha: ultimoSnapshot.fecha,
        registros: ultimoSnapshot.rows,
        resumen: ultimoSnapshot.resumen,
      };
    }
  }

  const fecha = new Date().toISOString();
  const registros = registrosBase.map((registro) => ({ ...registro, fecha }));

  const { data, error } = await db
    .from("stock_snapshots")
    .insert(registros)
    .select();

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];

  return {
    status: "created",
    fecha,
    registros: rows,
    resumen: construirResumenSnapshot(rows, fecha),
  };
}

export async function getDiferenciasStock() {
  const snapshots = await getSnapshotsRecientes(2);

  if (snapshots.length < 2) {
    return [];
  }

  const [snapshotActual, snapshotAnterior] = snapshots;
  const fechaActual = snapshotActual.fecha;
  const fechaAnterior = snapshotAnterior.fecha;

  const actual = {};
  const anterior = {};

  snapshotActual.rows.forEach((item) => {
    const productoId = Number(item?.producto_id);

    if (!esProductoIdValido(productoId)) {
      return;
    }

    actual[productoId] = normalizarCantidadSnapshot(item?.cantidad);
  });

  snapshotAnterior.rows.forEach((item) => {
    const productoId = Number(item?.producto_id);

    if (!esProductoIdValido(productoId)) {
      return;
    }

    anterior[productoId] = normalizarCantidadSnapshot(item?.cantidad);
  });

  const productoIds = new Set([
    ...Object.keys(actual),
    ...Object.keys(anterior),
  ]);

  return Array.from(productoIds)
    .map((productoId) => {
      const cantidadActual = actual[productoId] || 0;
      const cantidadAnterior = anterior[productoId] || 0;
      const diferencia = cantidadActual - cantidadAnterior;

      return {
        producto_id: Number(productoId),
        actual: cantidadActual,
        anterior: cantidadAnterior,
        diferencia,
        magnitud: Math.abs(diferencia),
        tipo:
          diferencia > 0
            ? "entrada"
            : diferencia < 0
              ? "salida"
              : "sin_cambio",
        snapshot_actual_fecha: fechaActual,
        snapshot_anterior_fecha: fechaAnterior,
      };
    })
    .sort((a, b) => b.magnitud - a.magnitud);
}
