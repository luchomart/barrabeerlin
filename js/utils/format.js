export function normalizarTexto(texto) {
  return (texto || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Cantidades: hasta 2 decimales (los productos con "permite decimales" en el admin).
// Redondea para evitar restos de coma flotante (0.1 + 0.2 = 0.30000000000000004).
// El ajuste minimo hace que 1.255 de 1.26 como en Postgres (1.255 * 100 = 125.4999...).
export function redondearCantidad(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) return 0;

  return Math.round(numero * 100 + Math.sign(numero) * 1e-9) / 100 || 0;
}

// Lee lo que tipea el empleado: acepta coma o punto ("1,5" y "1.5").
export function leerCantidad(valor) {
  const texto = String(valor ?? "").trim().replace(",", ".");

  if (texto === "") return NaN;

  return Number(texto);
}

// Para mostrar: coma decimal y sin ceros de mas ("2,5", "3", "-0,25").
export function formatearCantidad(valor) {
  return String(redondearCantidad(valor)).replace(".", ",");
}

// "hoy 21:40", "ayer 21:40" o "18/11 21:40".
export function formatearFechaConteo(fecha, ahora = new Date()) {
  const valida = fecha ? new Date(fecha) : null;

  if (!valida || Number.isNaN(valida.getTime())) return "";

  const hora = valida.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dia = new Date(valida.getFullYear(), valida.getMonth(), valida.getDate());
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const diasAtras = Math.round((hoy - dia) / 86400000);

  if (diasAtras === 0) return `hoy ${hora}`;
  if (diasAtras === 1) return `ayer ${hora}`;

  const fechaCorta = valida.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

  return `${fechaCorta} ${hora}`;
}
