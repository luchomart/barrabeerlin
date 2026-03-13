import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const { createClient } = supabase;

export const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// =============================
// SECTORES
// =============================

export async function getSectores() {
  const { data, error } = await db.from("sectores").select("*").order("nombre");

  if (error) throw error;

  return data;
}

// =============================
// PRODUCTOS
// =============================

export async function getProductos() {
  const { data, error } = await db.from("productos").select("*").order("orden");

  if (error) throw error;

  return data;
}

// =============================
// CATEGORIAS
// =============================

export async function getCategorias() {
  const { data, error } = await db
    .from("categorias")
    .select("*")
    .order("nombre");

  if (error) throw error;

  return data;
}

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
