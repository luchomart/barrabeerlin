import { appState } from "../../core/appState.js";

import {
  EMPLEADOS,
  ORDEN_CATEGORIAS_SECTOR,
  PASSWORD_SUPERVISOR,
} from "../../config.js";

import {
  getSectores,
  getProductos,
  getCategorias,
} from "../../services/catalogoService.js";

import {
  getInventarioSector,
  guardarInventario,
  saveStockSnapshot,
} from "../../services/inventarioService.js";

import {
  renderSectores,
  renderProductos,
  actualizarInputsStock,
} from "../../ui/renderer.js";

import { buildStockData, formatWhatsappText } from "./stockFormatter.js";

export function initStockApp() {
  const selectSector = document.getElementById("select-sector");
  const selectEmpleado = document.getElementById("select-empleado");
  const listaProductos = document.getElementById("lista-productos");
  const buscador = document.getElementById("buscar-producto");
  const tituloApp = document.getElementById("titulo-app");

  const btnGuardar = document.getElementById("btn-guardar");
  const btnCopiarStock = document.getElementById("btn-copiar-stock");
  const btnWppStock = document.getElementById("btn-wpp-stock");

  let contadorToques = 0;
  let snapshotGuardado = false;
  let ultimoEnvioWhatsapp = 0;

  function obtenerEmpleadoSeleccionado() {
    return selectEmpleado.value;
  }

  function obtenerSectorSeleccionado() {
    return selectSector.value;
  }

  function obtenerNombreSectorSeleccionado() {
    return selectSector.options[selectSector.selectedIndex]?.text || "";
  }

  function reflejarSectorActual() {
    selectSector.value = appState.sector;
  }

  function validarSeleccion() {
    const { empleado, sector } = appState;

    if (!empleado || !sector) {
      listaProductos.style.display = "none";
      btnGuardar.disabled = true;
      return false;
    }

    listaProductos.style.display = "block";
    btnGuardar.disabled = false;

    return true;
  }

  function cargarEmpleados() {
    selectEmpleado.innerHTML = "";

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

  function guardarEmpleadoLocal() {
    localStorage.setItem("empleado", appState.empleado);
  }

  function cargarEmpleadoLocal() {
    const empleadoGuardado = localStorage.getItem("empleado");

    if (!empleadoGuardado) return;

    appState.setEmpleado(empleadoGuardado);
    selectEmpleado.value = empleadoGuardado;
  }

  function obtenerCategoriasOrdenadas() {
    const orden = ORDEN_CATEGORIAS_SECTOR[
      obtenerNombreSectorSeleccionado().toLowerCase()
    ];

    if (!orden) {
      return [...appState.categorias];
    }

    return [...appState.categorias].sort((categoriaA, categoriaB) => {
      const posA = orden.indexOf(categoriaA.nombre);
      const posB = orden.indexOf(categoriaB.nombre);

      if (posA === -1) return 1;
      if (posB === -1) return -1;

      return posA - posB;
    });
  }

  function manejarCambioInput(input) {
    input.classList.add("input-modificado");
    appState.setCambiosPendientes(true);
  }

  function resetSnapshotGuardado() {
    snapshotGuardado = false;
  }

  function puedeGuardarSnapshot(data) {
    if (!data || typeof data !== "object") {
      return false;
    }

    const { stockPorProducto = {} } = data;

    if (!stockPorProducto || typeof stockPorProducto !== "object") {
      return false;
    }

    return Object.keys(stockPorProducto).length > 0;
  }

  function debounceWhatsapp() {
    const ahora = Date.now();

    if (ahora - ultimoEnvioWhatsapp < 1500) {
      return false;
    }

    ultimoEnvioWhatsapp = ahora;

    return true;
  }

  function normalizarCantidad(valor) {
    const cantidad = parseInt(valor, 10);

    if (Number.isNaN(cantidad)) {
      return 0;
    }

    if (cantidad < 0) {
      return 0;
    }

    if (cantidad > 1000) {
      return 1000;
    }

    return cantidad;
  }

  async function cargarStockSector() {
    const data = await getInventarioSector(appState.sector);

    actualizarInputsStock(data);
    appState.setCambiosPendientes(false);
    resetSnapshotGuardado();
  }

  async function renderizarYcargar() {
    if (!validarSeleccion()) return;

    renderProductos(
      listaProductos,
      obtenerCategoriasOrdenadas(),
      appState.productos,
      manejarCambioInput,
    );

    await cargarStockSector();
  }

  async function guardar() {
    try {
      const inputs = document.querySelectorAll("#lista-productos input");
      const registros = [];
      const ultimaActualizacion = new Date().toISOString();

      inputs.forEach((input) => {
        const cantidad = normalizarCantidad(input.value);

        input.value = cantidad;

        registros.push({
          producto_id: input.dataset.id,
          sector_id: appState.sector,
          cantidad,
          empleado: appState.empleado,
          ultima_actualizacion: ultimaActualizacion,
        });
      });

      await guardarInventario(registros);

      alert(`✅ Conteo guardado
Empleado: ${appState.empleado}
Sector: ${obtenerNombreSectorSeleccionado()}`);

      resetSnapshotGuardado();
      appState.resetSector();
      reflejarSectorActual();
      listaProductos.style.display = "none";
      validarSeleccion();
    } catch (error) {
      console.error(error);
      alert("Error guardando el conteo");
    }
  }

  async function manejarCambioEmpleado() {
    try {
      appState.setEmpleado(obtenerEmpleadoSeleccionado());
      guardarEmpleadoLocal();

      if (!validarSeleccion()) return;

      if (listaProductos.style.display === "block") {
        return;
      }

      await renderizarYcargar();
    } catch (error) {
      console.error(error);
      alert("Error cargando el stock del sector");
    }
  }

  async function manejarCambioSector() {
    const sectorSeleccionado = obtenerSectorSeleccionado();

    appState.setSector(sectorSeleccionado);

    if (appState.cambiosPendientes) {
      const confirmar = confirm(
        "Hay cambios sin guardar. Si cambiás de sector se perderán. ¿Continuar?",
      );

      if (!confirmar) {
        appState.rollbackSector();
        reflejarSectorActual();
        return;
      }
    }

    if (!validarSeleccion()) return;

    try {
      await renderizarYcargar();
    } catch (error) {
      console.error(error);
      alert("Error cargando el stock del sector");

      appState.rollbackSector();
      reflejarSectorActual();

      if (validarSeleccion()) {
        await renderizarYcargar();
      }
    }
  }

  async function compartirStock(abrirWhatsapp) {
    const data = await buildStockData(appState.productos, appState.categorias);
    const texto = formatWhatsappText(data, appState.productos);

    if (abrirWhatsapp) {
      const url =
        "https://api.whatsapp.com/send?text=" + encodeURIComponent(texto);

      window.open(url, "_blank");
      return;
    }

    await navigator.clipboard.writeText(texto);
    alert("📋 Copiado al portapapeles");
  }

  function configurarBuscador() {
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

          productos.forEach((producto) => {
            producto.style.display = "flex";
          });
        } else if (hayCoincidencias) {
          categoria.style.display = "block";
          productosDiv.classList.remove("categoria-cerrada");
          titulo.classList.add("categoria-abierta");
        } else {
          categoria.style.display = "none";
        }
      });
    });
  }

  function configurarAccesoSupervisor() {
    tituloApp.addEventListener("click", () => {
      contadorToques += 1;

      if (contadorToques < 5) return;

      contadorToques = 0;

      const pass = prompt("🔒 Contraseña de supervisor");

      if (!pass) return;

      if (pass === PASSWORD_SUPERVISOR) {
        window.location.href = "supervisor.html";
        return;
      }

      alert("Contraseña incorrecta");
    });
  }

  async function init() {
    try {
      listaProductos.style.display = "none";

      cargarEmpleados();
      cargarEmpleadoLocal();

      const [sectores, productos, categorias] = await Promise.all([
        getSectores(),
        getProductos(),
        getCategorias(),
      ]);

      appState.setCatalogo({ sectores, productos, categorias });

      renderSectores(selectSector, appState.sectores);
      validarSeleccion();
    } catch (error) {
      console.error(error);
      listaProductos.innerHTML = "❌ Error cargando la aplicación";
    }
  }

  btnGuardar.addEventListener("click", guardar);

  btnCopiarStock.addEventListener("click", async () => {
    try {
      await compartirStock(false);
    } catch (error) {
      console.error(error);
      alert("Error generando el stock");
    }
  });

  btnWppStock.addEventListener("click", async () => {
    if (!debounceWhatsapp()) {
      return;
    }

    try {
      const data = await buildStockData(appState.productos, appState.categorias);

      if (!snapshotGuardado && puedeGuardarSnapshot(data)) {
        try {
          await saveStockSnapshot(data);
          snapshotGuardado = true;
        } catch (error) {
          console.error(error);
        }
      }

      const texto = formatWhatsappText(data, appState.productos);
      const url =
        "https://api.whatsapp.com/send?text=" + encodeURIComponent(texto);

      window.open(url, "_blank");
    } catch (error) {
      console.error(error);
      alert("Error generando el stock");
    }
  });

  selectEmpleado.addEventListener("change", manejarCambioEmpleado);
  selectSector.addEventListener("change", manejarCambioSector);

  configurarBuscador();
  configurarAccesoSupervisor();

  init();
}
