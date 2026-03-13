import { supabase } from "./config.js";

const listaConteos = document.getElementById("lista-conteos");
const estadoSectores = document.getElementById("estado-sectores");
const btnRecargar = document.getElementById("btn-recargar");
const btnVolver = document.getElementById("btn-volver");

// =============================
// VOLVER A EMPLEADOS
// =============================

btnVolver.addEventListener("click", () => {
  window.location.href = "index.html";
});

// =============================
// CARGAR SECTORES
// =============================

async function cargarSectores() {
  const { data, error } = await supabase.from("sectores").select("*");

  if (error) {
    console.error(error);

    return [];
  }

  return data;
}

// =============================
// CARGAR CONTEOS
// =============================

async function cargarConteos() {
  try {
    listaConteos.innerHTML = "Cargando conteos...";

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("inventario")
      .select(
        `
        empleado,
        sector_id,
        ultima_actualizacion,
        sectores(nombre)
      `,
      )
      .gte("ultima_actualizacion", hoy.toISOString())
      .order("ultima_actualizacion", { ascending: false });

    if (error) throw error;

    mostrarConteos(data);

    await mostrarEstadoSectores(data);
  } catch (err) {
    console.error(err);

    listaConteos.innerHTML = "❌ Error cargando datos";
  }
}

// =============================
// MOSTRAR CONTEOS
// =============================

function mostrarConteos(data) {
  if (!data.length) {
    listaConteos.innerHTML = "No hay conteos hoy";

    return;
  }

  const conteos = {};

  data.forEach((item) => {
    const clave = item.sector_id;

    if (!conteos[clave]) {
      conteos[clave] = item;
    }
  });

  listaConteos.innerHTML = "";

  Object.values(conteos).forEach((conteo) => {
    const fecha = new Date(conteo.ultima_actualizacion);

    const div = document.createElement("div");

    div.className = "stock-sector";

    div.innerHTML = `
    
    <h3>👤 ${conteo.empleado}</h3>

    <p>
    📦 ${conteo.sectores?.nombre || "Sector"}
    </p>

    <p>
    🕒 ${fecha.toLocaleTimeString("es-AR")}
    </p>

    `;

    listaConteos.appendChild(div);
  });
}

// =============================
// ESTADO DE SECTORES
// =============================

async function mostrarEstadoSectores(conteos) {
  const sectores = await cargarSectores();

  const sectoresContados = new Set();

  conteos.forEach((c) => {
    sectoresContados.add(c.sector_id);
  });

  estadoSectores.innerHTML = "";

  sectores.forEach((sector) => {
    const div = document.createElement("div");

    div.className = "stock-sector";

    const contado = sectoresContados.has(sector.id);

    div.innerHTML = `
    
    <p>
    ${contado ? "✅" : "❌"} 
    ${sector.nombre}
    </p>

    `;

    estadoSectores.appendChild(div);
  });
}

// =============================
// DETECTOR DE ERRORES
// =============================

async function detectarErrores() {
  const { data, error } = await supabase.from("inventario").select(`
      cantidad,
      producto_id,
      sectores(nombre)
    `);

  if (error) {
    console.error(error);
    return;
  }

  const productos = {};

  data.forEach((item) => {
    if (!productos[item.producto_id]) {
      productos[item.producto_id] = [];
    }

    productos[item.producto_id].push(item);
  });

  Object.values(productos).forEach((lista) => {
    if (lista.length < 2) return;

    const cantidades = lista.map((i) => i.cantidad);

    const promedio = cantidades.reduce((a, b) => a + b, 0) / cantidades.length;

    lista.forEach((i) => {
      if (i.cantidad > promedio * 3) {
        console.warn(
          "⚠ Posible error en",
          i.sectores?.nombre,
          "cantidad:",
          i.cantidad,
        );
      }
    });
  });
}

// =============================
// EXPORTAR STOCK A WHATSAPP
// =============================

const btnWhatsapp = document.getElementById("btn-whatsapp");

btnWhatsapp.addEventListener("click", enviarStockWhatsapp);

async function enviarStockWhatsapp() {
  const { data, error } = await supabase.from("inventario").select(`
      cantidad,
      productos(nombre)
    `);

  if (error) {
    console.error(error);
    return;
  }

  const total = {};

  data.forEach((item) => {
    const nombre = item.productos?.nombre;

    if (!total[nombre]) {
      total[nombre] = 0;
    }

    total[nombre] += item.cantidad;
  });

  let mensaje = "📦 STOCK TOTAL\n\n";

  Object.entries(total).forEach(([producto, cantidad]) => {
    mensaje += `${producto}: ${cantidad}\n`;
  });

  const url = "https://wa.me/?text=" + encodeURIComponent(mensaje);

  window.open(url);
}

// =============================
// AUTO REFRESH
// =============================

setInterval(cargarConteos, 30000);

// =============================
// EVENTOS
// =============================

btnRecargar.addEventListener("click", cargarConteos);

// =============================
// START
// =============================

cargarConteos();
detectarErrores();
