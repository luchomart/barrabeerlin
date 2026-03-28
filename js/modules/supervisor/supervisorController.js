import {
  getProductos,
  getCategorias,
  getSectores,
} from "../../services/catalogoService.js";

import {
  getConteosDesde,
  getDiferenciasStock,
  getInventarioConSectores,
} from "../../services/inventarioService.js";

import {
  buildStockChanges,
  buildStockData,
  formatPlainText,
} from "../stock/stockFormatter.js";

import {
  renderSupervisorCambios,
  renderSupervisorConteos,
  renderSupervisorError,
  renderSupervisorEstadoSectores,
  renderSupervisorLoader,
} from "../../ui/renderer.js";

function obtenerInicioDeHoy() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return hoy.toISOString();
}

function obtenerUltimoConteoPorSector(conteos = []) {
  const conteosPorSector = {};

  conteos.forEach((conteo) => {
    if (!conteosPorSector[conteo.sector_id]) {
      conteosPorSector[conteo.sector_id] = conteo;
    }
  });

  return Object.values(conteosPorSector);
}

function obtenerSectoresContados(conteos = []) {
  return new Set(conteos.map((conteo) => conteo.sector_id));
}

export function initSupervisorApp() {
  const listaConteos = document.getElementById("lista-conteos");
  const estadoSectores = document.getElementById("estado-sectores");
  const listaCambiosStock = document.getElementById("lista-cambios-stock");
  const btnRecargar = document.getElementById("btn-recargar");
  const btnVolver = document.getElementById("btn-volver");
  const btnWhatsapp = document.getElementById("btn-whatsapp");

  async function cargarResumen() {
    renderSupervisorLoader(listaConteos, "Cargando ultimos conteos...");
    renderSupervisorLoader(estadoSectores, "Cargando estado de sectores...");

    try {
      const [conteos, sectores] = await Promise.all([
        getConteosDesde(obtenerInicioDeHoy()),
        getSectores(),
      ]);

      renderSupervisorConteos(
        listaConteos,
        obtenerUltimoConteoPorSector(Array.isArray(conteos) ? conteos : []),
      );
      renderSupervisorEstadoSectores(
        estadoSectores,
        Array.isArray(sectores) ? sectores : [],
        obtenerSectoresContados(Array.isArray(conteos) ? conteos : []),
      );
    } catch (error) {
      console.error(error);
      renderSupervisorError(listaConteos, "Error cargando conteos");
      renderSupervisorError(estadoSectores, "Error cargando sectores");
    }
  }

  async function cargarCambiosStock() {
    renderSupervisorLoader(listaCambiosStock, "Calculando cambios de stock...");

    try {
      const [diferencias, productos] = await Promise.all([
        getDiferenciasStock(),
        getProductos(),
      ]);

      const cambios = buildStockChanges(diferencias, productos);

      renderSupervisorCambios(listaCambiosStock, cambios);
    } catch (error) {
      console.error(error);
      renderSupervisorError(listaCambiosStock, "Error cargando cambios");
    }
  }

  async function actualizarSupervisor() {
    await Promise.all([cargarResumen(), cargarCambiosStock()]);
  }

  async function detectarErrores() {
    try {
      const data = await getInventarioConSectores();
      const productos = {};

      (Array.isArray(data) ? data : []).forEach((item) => {
        if (!productos[item.producto_id]) {
          productos[item.producto_id] = [];
        }

        productos[item.producto_id].push(item);
      });

      Object.values(productos).forEach((lista) => {
        if (lista.length < 2) return;

        const cantidades = lista.map((item) => item.cantidad);
        const promedio =
          cantidades.reduce((acumulado, valor) => acumulado + valor, 0) /
          cantidades.length;

        lista.forEach((item) => {
          if (item.cantidad > promedio * 3) {
            console.warn(
              "Posible error en",
              item.sectores?.nombre,
              "cantidad:",
              item.cantidad,
            );
          }
        });
      });
    } catch (error) {
      console.error(error);
    }
  }

  async function enviarStockWhatsapp() {
    try {
      const [productos, categorias] = await Promise.all([
        getProductos(),
        getCategorias(),
      ]);

      const data = await buildStockData(productos, categorias);
      const texto = formatPlainText(data, productos);
      const url = "https://wa.me/?text=" + encodeURIComponent(texto);

      window.open(url, "_blank");
    } catch (error) {
      console.error(error);
      alert("Error generando el stock");
    }
  }

  btnVolver.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  btnRecargar.addEventListener("click", actualizarSupervisor);
  btnWhatsapp.addEventListener("click", enviarStockWhatsapp);

  setInterval(actualizarSupervisor, 30000);

  actualizarSupervisor();
  detectarErrores();
}
