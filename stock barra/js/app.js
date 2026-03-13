// =============================
// IMPORTS
// =============================
import { ORDEN_CATEGORIAS_SECTOR } from "./config.js";

import { generarStockTotal } from "./stockReport.js";

import {
  getSectores,
  getProductos,
  getCategorias,
  getInventarioSector,
  guardarInventario,
} from "./dataService.js";

import {
  renderSectores,
  renderProductos,
  actualizarInputsStock,
} from "./uiRenderer.js";

import { EMPLEADOS } from "./config.js";

// =============================
// ELEMENTOS DEL DOM
// =============================

const selectSector = document.getElementById("select-sector");
const selectEmpleado = document.getElementById("select-empleado");

const listaProductos = document.getElementById("lista-productos");

const btnGuardar = document.getElementById("btn-guardar");

const buscador = document.getElementById("buscar-producto");
const btnSupervisor = document.getElementById("btn-supervisor");
const btnCopiarStock = document.getElementById("btn-copiar-stock");
const btnWppStock = document.getElementById("btn-wpp-stock");

// =============================
// VARIABLES
// =============================

let productos = [];
let categorias = [];
let sectores = [];

let cambiosPendientes = false;

// =============================
// ORDENAR CATEGORÍAS SEGÚN SECTOR
// =============================

function ordenarCategoriasPorSector() {
  const sectorNombre =
    selectSector.options[selectSector.selectedIndex].text.toLowerCase();

  const orden = ORDEN_CATEGORIAS_SECTOR[sectorNombre];

  if (!orden) return;

  categorias.sort((a, b) => {
    const posA = orden.indexOf(a.nombre);
    const posB = orden.indexOf(b.nombre);

    if (posA === -1) return 1;
    if (posB === -1) return -1;

    return posA - posB;
  });
}

// =============================
// CARGAR EMPLEADOS
// =============================

function cargarEmpleados() {
  const optionInicial = document.createElement("option");
  optionInicial.value = "";
  optionInicial.textContent = "Seleccionar...";
  selectEmpleado.appendChild(optionInicial);

  EMPLEADOS.forEach((empleado) => {
    if (!empleado) return;

    const option = document.createElement("option");

    option.value = empleado;
    option.textContent = empleado;

    selectEmpleado.appendChild(option);
  });
}

// =============================
// RECORDAR EMPLEADO
// =============================

function guardarEmpleadoLocal() {
  localStorage.setItem("empleado", selectEmpleado.value);
}

function cargarEmpleadoLocal() {
  const empleadoGuardado = localStorage.getItem("empleado");

  if (empleadoGuardado) {
    selectEmpleado.value = empleadoGuardado;
  }
}

// =============================
// INICIALIZAR APP
// =============================

async function init() {
  // ocultar productos al iniciar
  listaProductos.style.display = "none";

  // cargar empleados
  cargarEmpleados();
  cargarEmpleadoLocal();

  // cargar sectores
  sectores = await getSectores();
  renderSectores(selectSector, sectores);

  // cargar productos y categorias
  productos = await getProductos();
  categorias = await getCategorias();

  ordenarCategoriasPorSector();

  renderProductos(listaProductos, categorias, productos, manejarCambioInput);

  // validar selección antes de cargar stock
  if (validarSeleccion()) {
    await cargarStockSector();
  }

  selectSector.dataset.anterior = selectSector.value;
  validarSeleccion();
}

// =============================
// DETECTAR CAMBIOS EN INPUT
// =============================

function manejarCambioInput(input) {
  input.classList.add("input-modificado");

  cambiosPendientes = true;
}

// =============================
// CARGAR STOCK DEL SECTOR
// =============================

async function cargarStockSector() {
  const sectorId = selectSector.value;

  const data = await getInventarioSector(sectorId);

  actualizarInputsStock(data);

  cambiosPendientes = false;
}

// =============================
// GUARDAR INVENTARIO
// =============================

async function guardar() {
  const sectorId = selectSector.value;
  const empleado = selectEmpleado.value;

  const inputs = document.querySelectorAll("#lista-productos input");

  let registros = [];

  inputs.forEach((input) => {
    registros.push({
      producto_id: input.dataset.id,
      sector_id: sectorId,
      cantidad: parseInt(input.value) || 0,
      empleado: empleado,
    });
  });

  await guardarInventario(registros);

  alert(`✅ Conteo guardado
Empleado: ${empleado}
Sector: ${selectSector.options[selectSector.selectedIndex].text}`);

  cambiosPendientes = false;

  // =============================
  // RESET SECTOR
  // =============================

  selectSector.value = "";
  listaProductos.style.display = "none";
  validarSeleccion();
}

// =============================
// EVENTOS
// =============================

btnGuardar.addEventListener("click", guardar);

selectEmpleado.addEventListener("change", () => {
  guardarEmpleadoLocal();

  validarSeleccion();
});

btnCopiarStock.addEventListener("click", () => {
  generarStockTotal(productos, categorias);
});

btnWppStock.addEventListener("click", async () => {
  const texto = await generarStockTotal(productos, categorias, true);

  const url = "https://api.whatsapp.com/send?text=" + encodeURIComponent(texto);

  window.open(url, "_blank");
});

// =============================
// CAMBIO DE SECTOR
// =============================

selectSector.addEventListener("change", async () => {
  if (!validarSeleccion()) return;

  ordenarCategoriasPorSector();

  renderProductos(listaProductos, categorias, productos, manejarCambioInput);

  if (cambiosPendientes) {
    const confirmar = confirm(
      "Hay cambios sin guardar. Si cambiás de sector se perderán. ¿Continuar?",
    );

    if (!confirmar) {
      selectSector.value = selectSector.dataset.anterior;
      return;
    }
  }

  selectSector.dataset.anterior = selectSector.value;

  await cargarStockSector();
});

// =============================
// VALIDAR SELECCIÓN
// =============================

function validarSeleccion() {
  const empleado = selectEmpleado.value;
  const sector = selectSector.value;

  if (!empleado || !sector) {
    listaProductos.style.display = "none";

    btnGuardar.disabled = true;

    return false;
  }

  listaProductos.style.display = "block";

  btnGuardar.disabled = false;

  return true;
}

// =============================
// BUSCADOR DE PRODUCTOS
// ⚠ ESTABLE - FUNCIONA PERFECTO
// NO MODIFICAR SIN TESTEAR
// =============================

buscador.addEventListener("input", () => {
  const texto = buscador.value.toLowerCase();

  const categorias = document.querySelectorAll(".categoria-bloque");

  categorias.forEach((categoria) => {
    const productos = categoria.querySelectorAll(".producto-fila");

    const productosDiv = categoria.querySelector(".categoria-productos");
    const titulo = categoria.querySelector(".categoria-titulo");

    let hayCoincidencias = false;

    productos.forEach((producto) => {
      const nombre = producto.dataset.nombre;

      if (nombre.includes(texto)) {
        producto.style.display = "flex";
        hayCoincidencias = true;
      } else {
        producto.style.display = "none";
      }
    });

    if (texto === "") {
      categoria.style.display = "block";

      productosDiv.classList.add("categoria-cerrada");
      titulo.classList.remove("categoria-abierta");

      productos.forEach((p) => (p.style.display = "flex"));
    } else if (hayCoincidencias) {
      categoria.style.display = "block";

      productosDiv.classList.remove("categoria-cerrada");
      titulo.classList.add("categoria-abierta");
    } else {
      categoria.style.display = "none";
    }
  });
});

// =============================
// ACCESO SECRETO SUPERVISOR
// =============================

import { PASSWORD_SUPERVISOR } from "./config.js";

const tituloApp = document.getElementById("titulo-app");

let contadorToques = 0;

tituloApp.addEventListener("click", () => {
  contadorToques++;

  if (contadorToques >= 5) {
    contadorToques = 0;

    const pass = prompt("🔒 Contraseña de supervisor");

    if (!pass) return;

    if (pass === PASSWORD_SUPERVISOR) {
      window.location.href = "supervisor.html";
    } else {
      alert("Contraseña incorrecta");
    }
  }
});

// =============================
// START
// =============================

init();
