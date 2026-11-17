import { supabase } from "./supabaseClient.js";

const db = supabase;

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
// EMPLEADOS
// =============================

export async function getEmpleados() {
  const { data, error } = await db
    .from("empleados")
    .select("id, nombre")
    .order("id");

  if (error) throw error;

  return data;
}
