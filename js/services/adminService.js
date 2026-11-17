import { supabase } from "./supabaseClient.js";

const db = supabase;

// Las RPCs admin_* validan en Supabase que la sesion sea de supervisor.
// Este service solo arma los parametros y traduce errores a texto para la UI.

const MENSAJES_POR_CODIGO = {
  42501: "Solo el supervisor puede hacer cambios de administracion.",
};

export function obtenerMensajeErrorAdmin(error) {
  if (!error) {
    return "No se pudo completar la operacion.";
  }

  const mensaje = String(error.message || "").trim();
  const codigo = String(error.code || "");

  if (codigo === "42501" && mensaje.toLowerCase().includes("permission denied")) {
    return MENSAJES_POR_CODIGO[42501];
  }

  if (mensaje.toLowerCase().includes("failed to fetch")) {
    return "No se pudo conectar con el servidor.";
  }

  return mensaje || "No se pudo completar la operacion.";
}

async function llamarRpc(nombre, params) {
  const { data, error } = await db.rpc(nombre, params);

  if (error) {
    const errorAdmin = new Error(obtenerMensajeErrorAdmin(error));
    errorAdmin.cause = error;
    throw errorAdmin;
  }

  return data;
}

function limpiarNombre(nombre) {
  return String(nombre ?? "").replace(/\s+/g, " ").trim();
}

function exigirId(valor, entidad) {
  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Id de ${entidad} invalido.`);
  }

  return id;
}

function exigirNombre(nombre) {
  const limpio = limpiarNombre(nombre);

  if (!limpio) {
    throw new Error("El nombre no puede estar vacio.");
  }

  return limpio;
}

export async function agregarEmpleado(nombre) {
  return llamarRpc("admin_agregar_empleado", { nombre: exigirNombre(nombre) });
}

export async function eliminarEmpleado(id) {
  return llamarRpc("admin_eliminar_empleado", {
    empleado_id: exigirId(id, "empleado"),
  });
}

export async function agregarCategoria(nombre) {
  return llamarRpc("admin_agregar_categoria", { nombre: exigirNombre(nombre) });
}

export async function eliminarCategoria(id) {
  return llamarRpc("admin_eliminar_categoria", {
    categoria_id: exigirId(id, "categoria"),
  });
}

export async function agregarProducto(nombre, categoriaId) {
  return llamarRpc("admin_agregar_producto", {
    nombre: exigirNombre(nombre),
    categoria_id: exigirId(categoriaId, "categoria"),
  });
}

export async function eliminarProducto(id) {
  return llamarRpc("admin_eliminar_producto", {
    producto_id: exigirId(id, "producto"),
  });
}
