// Conteo a prueba de cortes de internet.
// - Borradores: lo que se va tipeando en cada sector se guarda en el celular, asi un
//   cierre o recarga de la pagina no pierde el conteo.
// - Pendientes: si "Guardar" falla por falta de conexion, el conteo queda en una
//   cola local y se reenvia cuando vuelve internet.
// - Empleados: copia de la ultima lista cargada, por si falla la carga.

const CLAVE_BORRADORES = "stock-borradores";
const CLAVE_PENDIENTES = "stock-pendientes";
const CLAVE_EMPLEADOS = "stock-empleados";

function almacenPorDefecto() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function leer(clave, storage) {
  try {
    const texto = storage?.getItem(clave);
    return texto ? JSON.parse(texto) : null;
  } catch {
    return null;
  }
}

// Devuelve false si no se pudo guardar (almacenamiento lleno, bloqueado o ausente).
function escribir(clave, valor, storage) {
  try {
    if (!storage) return false;

    if (valor === null || valor === undefined) {
      storage.removeItem(clave);
    } else {
      storage.setItem(clave, JSON.stringify(valor));
    }

    return true;
  } catch {
    return false;
  }
}

// ---------- Borradores (uno por sector) ----------

function leerTodosLosBorradores(storage) {
  const borradores = leer(CLAVE_BORRADORES, storage);

  return borradores && typeof borradores === "object" && !Array.isArray(borradores)
    ? borradores
    : {};
}

function esBorradorValido(borrador) {
  return Boolean(
    borrador?.sector_id &&
      borrador.cantidades &&
      typeof borrador.cantidades === "object" &&
      Object.keys(borrador.cantidades).length,
  );
}

export function leerBorrador(sectorId, storage = almacenPorDefecto()) {
  const borrador = leerTodosLosBorradores(storage)[String(sectorId)];

  return esBorradorValido(borrador) ? borrador : null;
}

// El borrador tocado mas recientemente (para retomarlo al abrir la app).
export function leerUltimoBorrador(storage = almacenPorDefecto()) {
  return (
    Object.values(leerTodosLosBorradores(storage))
      .filter(esBorradorValido)
      .sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado)))[0] ||
    null
  );
}

export function guardarBorrador(
  { sector_id, sector_nombre = "", empleado = "", cantidades = {} } = {},
  storage = almacenPorDefecto(),
) {
  if (!sector_id) return false;

  if (!Object.keys(cantidades).length) {
    return borrarBorrador(sector_id, storage);
  }

  return escribir(
    CLAVE_BORRADORES,
    {
      ...leerTodosLosBorradores(storage),
      [String(sector_id)]: {
        sector_id: String(sector_id),
        sector_nombre,
        empleado,
        cantidades,
        actualizado: new Date().toISOString(),
      },
    },
    storage,
  );
}

export function borrarBorrador(sectorId, storage = almacenPorDefecto()) {
  const borradores = leerTodosLosBorradores(storage);

  delete borradores[String(sectorId)];

  return escribir(
    CLAVE_BORRADORES,
    Object.keys(borradores).length ? borradores : null,
    storage,
  );
}

// ---------- Cola de conteos sin enviar ----------

export function leerPendientes(storage = almacenPorDefecto()) {
  const pendientes = leer(CLAVE_PENDIENTES, storage);

  return Array.isArray(pendientes)
    ? pendientes.filter((item) => item?.id && Array.isArray(item.registros))
    : [];
}

export function agregarPendiente(
  { registros = [], sector_id, sector_nombre = "", empleado = "", creado } = {},
  storage = almacenPorDefecto(),
) {
  const pendiente = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    registros,
    sector_id: String(sector_id),
    sector_nombre,
    empleado,
    creado: creado || new Date().toISOString(),
  };

  const guardado = escribir(
    CLAVE_PENDIENTES,
    [...leerPendientes(storage), pendiente],
    storage,
  );

  return guardado ? pendiente : null;
}

export function quitarPendiente(id, storage = almacenPorDefecto()) {
  const restantes = leerPendientes(storage).filter((item) => item.id !== id);

  return escribir(CLAVE_PENDIENTES, restantes.length ? restantes : null, storage);
}

// ---------- Copia de la lista de empleados ----------

export function guardarEmpleadosCache(empleados, storage = almacenPorDefecto()) {
  if (!Array.isArray(empleados)) return false;

  return escribir(
    CLAVE_EMPLEADOS,
    empleados.filter((e) => e?.nombre).map(({ id, nombre }) => ({ id, nombre })),
    storage,
  );
}

export function leerEmpleadosCache(storage = almacenPorDefecto()) {
  const empleados = leer(CLAVE_EMPLEADOS, storage);

  return Array.isArray(empleados) ? empleados.filter((e) => e?.nombre) : [];
}

// ---------- Reglas ----------

// Supabase no lanza excepciones de red: devuelve un error con el mensaje del fetch
// ("TypeError: Failed to fetch" en Chrome, "NetworkError..." en Firefox,
// "Load failed" en Safari).
export function esErrorDeRed(error, online = globalThis.navigator?.onLine) {
  if (online === false) return true;

  const mensaje = String(error?.message || error || "");

  return /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(
    mensaje,
  );
}

// true si el sector ya tiene un conteo guardado despues de `creado`.
export function hayConteoMasNuevo(filasSector = [], creado) {
  const limite = Date.parse(creado);

  if (Number.isNaN(limite)) return false;

  return (Array.isArray(filasSector) ? filasSector : []).some((fila) => {
    const fecha = Date.parse(fila?.ultima_actualizacion);
    return !Number.isNaN(fecha) && fecha > limite;
  });
}

// Envia la cola en orden. Si falla por red, corta y deja ese y los siguientes para
// el proximo intento. Ojo: entre el chequeo de "conteo mas nuevo" y el envio hay una
// ventana minima en la que otro guardado del mismo sector podria quedar pisado.
export async function enviarPendientes({
  getInventarioSector,
  guardarInventario,
  storage = almacenPorDefecto(),
} = {}) {
  const resultado = { enviados: [], descartados: [], fallidos: [], error: null };

  for (const pendiente of leerPendientes(storage)) {
    try {
      const filas = await getInventarioSector(pendiente.sector_id);

      if (hayConteoMasNuevo(filas, pendiente.creado)) {
        resultado.descartados.push(pendiente);
      } else {
        await guardarInventario(pendiente.registros);
        resultado.enviados.push(pendiente);
      }

      quitarPendiente(pendiente.id, storage);
    } catch (error) {
      // Sin red: se corta y se reintenta despues.
      if (esErrorDeRed(error)) {
        resultado.error = error;
        break;
      }

      // Otro error (ej. borraron un producto del conteo): reintentar no lo arregla,
      // asi que sale de la cola para no trabar a los demas y se avisa.
      quitarPendiente(pendiente.id, storage);
      resultado.fallidos.push({ ...pendiente, motivo: error?.message || String(error) });
    }
  }

  return resultado;
}
