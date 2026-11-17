import { appState } from "../../core/appState.js";

import {
  CATEGORIA_VIRTUAL_BARRILES,
  NOMBRE_CATEGORIA_BARRILES,
  ORDEN_CATEGORIAS_SECTOR,
  PRODUCTOS_BARRILES_CAMARA,
} from "../../config.js";

import {
  getSectores,
  getProductos,
  getCategorias,
  getEmpleados,
} from "../../services/catalogoService.js";

import {
  getInventarioSector,
  guardarInventario,
  saveStockSnapshot,
} from "../../services/inventarioService.js";

import {
  renderAvisoStock,
  renderSectores,
  renderProductos,
  actualizarInputsStock,
} from "../../ui/renderer.js";
import { normalizarTexto } from "../../utils/format.js";
import {
  buildCatalogoRenderizable,
  obtenerIdsCategoriasBarriles,
} from "./stockCatalog.js";
import {
  agregarPendiente,
  borrarBorrador,
  enviarPendientes,
  esErrorDeRed,
  guardarBorrador,
  guardarEmpleadosCache,
  leerBorrador,
  leerEmpleadosCache,
  leerUltimoBorrador,
  leerPendientes,
} from "./stockBorrador.js";

import { buildStockData, formatWhatsappText } from "./stockFormatter.js";

const BARRILES = PRODUCTOS_BARRILES_CAMARA.map((nombre) =>
  normalizarTexto(nombre),
);

export function initStockApp() {
  const selectSector = document.getElementById("select-sector");
  const selectEmpleado = document.getElementById("select-empleado");
  const listaProductos = document.getElementById("lista-productos");
  const buscador = document.getElementById("buscar-producto");
  const tituloApp = document.getElementById("titulo-app");
  const avisoStock = document.getElementById("aviso-stock");

  const btnGuardar = document.getElementById("btn-guardar");
  const btnCopiarStock = document.getElementById("btn-copiar-stock");
  const btnWppStock = document.getElementById("btn-wpp-stock");

  let contadorToques = 0;
  let snapshotGuardado = false;
  let ultimoEnvioWhatsapp = 0;
  // Sector cuyos productos y stock ya estan en pantalla (null si no hay ninguno).
  let sectorRenderizado = null;
  let guardando = false;
  let enviandoPendientes = false;
  let timerAviso = null;

  function formatearHora(fechaIso) {
    const fecha = new Date(fechaIso);

    return Number.isNaN(fecha.getTime())
      ? ""
      : fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }

  // Los avisos temporales desaparecen solos y vuelve a verse el de pendientes (si hay).
  function mostrarAviso(tipo, texto) {
    clearTimeout(timerAviso);
    renderAvisoStock(avisoStock, { tipo, texto });
    timerAviso = setTimeout(actualizarAvisoPendientes, 8000);
  }

  function actualizarAvisoPendientes() {
    clearTimeout(timerAviso);

    const cantidad = leerPendientes().length;

    if (!cantidad) {
      renderAvisoStock(avisoStock);
      return;
    }

    renderAvisoStock(avisoStock, {
      tipo: "pendiente",
      texto:
        (cantidad === 1
          ? "\u{1F4E4} 1 conteo sin enviar por falta de conexion."
          : `\u{1F4E4} ${cantidad} conteos sin enviar por falta de conexion.`) +
        " Se envia solo cuando vuelva internet: no hace falta volver a contar.",
    });
  }

  function obtenerEmpleadoSeleccionado() {
    return selectEmpleado.value;
  }

  function obtenerSectorSeleccionado() {
    return selectSector.value;
  }

  function obtenerNombreSectorSeleccionado() {
    return selectSector.options[selectSector.selectedIndex]?.text || "";
  }

  function obtenerSectorNormalizado() {
    return normalizarTexto(
      selectSector.options[selectSector.selectedIndex]?.text,
    );
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

  function cargarEmpleados(empleados = []) {
    selectEmpleado.innerHTML = "";

    const optionInicial = document.createElement("option");
    optionInicial.value = "";
    optionInicial.textContent = "Seleccionar...";

    selectEmpleado.appendChild(optionInicial);

    (Array.isArray(empleados) ? empleados : []).forEach(({ nombre }) => {
      if (!nombre) return;

      const option = document.createElement("option");
      option.value = nombre;
      option.textContent = nombre;

      selectEmpleado.appendChild(option);
    });
  }

  function leerEmpleadoGuardado() {
    try {
      return localStorage.getItem("empleado") || "";
    } catch {
      return "";
    }
  }

  function guardarEmpleadoLocal() {
    try {
      localStorage.setItem("empleado", appState.empleado);
    } catch (error) {
      console.error(error);
    }
  }

  function cargarEmpleadoLocal() {
    const empleadoGuardado = leerEmpleadoGuardado();

    if (!empleadoGuardado) return;

    // Si el empleado guardado fue eliminado por el admin, se ignora.
    const existe = Array.from(selectEmpleado.options).some(
      (option) => option.value && option.value === empleadoGuardado,
    );

    if (!existe) {
      try {
        localStorage.removeItem("empleado");
      } catch (error) {
        console.error(error);
      }
      return;
    }

    appState.setEmpleado(empleadoGuardado);
    selectEmpleado.value = empleadoGuardado;
  }

  function obtenerCatalogoRenderizable() {
    const catalogo = buildCatalogoRenderizable({
      sectorNombre: obtenerSectorNormalizado(),
      categorias: appState.categorias,
      productos: appState.productos,
      ordenCategoriasSector: ORDEN_CATEGORIAS_SECTOR,
      categoriaVirtualBarriles: CATEGORIA_VIRTUAL_BARRILES,
      nombresBarrilesNormalizados: BARRILES,
      idsCategoriasBarriles: obtenerIdsCategoriasBarriles(
        appState.categorias,
        NOMBRE_CATEGORIA_BARRILES,
      ),
    });

    if (catalogo.sinBarrilesConfigurados) {
      console.warn("No se encontraron barriles configurados para Camara.");
    }

    return {
      categorias: catalogo.categorias,
      productos: catalogo.productos,
    };
  }

  function manejarCambioInput(input) {
    input.classList.add("input-modificado");
    appState.setCambiosPendientes(true);
    actualizarBorrador();
  }

  // Guarda en el celular lo tipeado en el sector actual (sobrevive a cierres y recargas).
  function actualizarBorrador() {
    if (!sectorRenderizado || sectorRenderizado !== appState.sector) return;

    const cantidades = {};

    listaProductos.querySelectorAll("input.input-modificado").forEach((input) => {
      cantidades[input.dataset.id] = input.value;
    });

    guardarBorrador({
      sector_id: appState.sector,
      sector_nombre: obtenerNombreSectorSeleccionado(),
      empleado: appState.empleado,
      cantidades,
    });
  }

  // Pone encima del stock de Supabase lo que habia quedado sin guardar en este sector.
  function aplicarBorrador() {
    const borrador = leerBorrador(appState.sector);

    // El borrador de otro empleado no se mezcla: queda guardado para cuando vuelva.
    if (!borrador || (borrador.empleado && borrador.empleado !== appState.empleado)) {
      return null;
    }

    let aplicados = 0;

    listaProductos.querySelectorAll("input[data-id]").forEach((input) => {
      const valor = borrador.cantidades[input.dataset.id];

      if (valor === undefined || valor === "") return;

      input.value = valor;
      input.classList.add("input-modificado");
      aplicados += 1;
    });

    if (!aplicados) return null;

    appState.setCambiosPendientes(true);

    return borrador;
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

  async function guardarSnapshotSiCorresponde(data) {
    if (snapshotGuardado || !puedeGuardarSnapshot(data)) {
      return null;
    }

    const resultado = await saveStockSnapshot(data);

    if (
      resultado?.status === "created" ||
      resultado?.status === "deduplicated"
    ) {
      snapshotGuardado = true;
    }

    return resultado;
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

  // Devuelve false si mientras cargaba se eligio otro sector (la respuesta se descarta).
  async function cargarStockSector(sector) {
    const data = await getInventarioSector(sector);

    if (sector !== appState.sector) return false;

    actualizarInputsStock(data);
    appState.setCambiosPendientes(false);
    resetSnapshotGuardado();

    return true;
  }

  async function renderizarYCargar() {
    if (!validarSeleccion()) return;

    sectorRenderizado = null;

    const { categorias, productos } = obtenerCatalogoRenderizable();

    renderProductos(
      listaProductos,
      categorias,
      productos,
      manejarCambioInput,
    );

    const sector = appState.sector;

    if (!(await cargarStockSector(sector))) return;

    sectorRenderizado = sector;

    const recuperado = aplicarBorrador();

    if (recuperado) {
      mostrarAviso(
        "info",
        `Se recupero el conteo sin guardar de ${recuperado.sector_nombre || "este sector"}` +
          ` (${formatearHora(recuperado.actualizado)}). Revisalo y toca Guardar.`,
      );
    }
  }

  // Deja la pantalla lista para el proximo conteo.
  function finalizarConteo() {
    resetSnapshotGuardado();
    sectorRenderizado = null;
    appState.resetSector();
    reflejarSectorActual();
    listaProductos.style.display = "none";
    validarSeleccion();
  }

  async function guardar() {
    if (guardando) return;

    const registros = [];
    const ultimaActualizacion = new Date().toISOString();

    guardando = true;

    try {
      const inputs = document.querySelectorAll("#lista-productos input");

      if (!inputs.length || sectorRenderizado !== appState.sector) {
        alert("Todavia no se cargaron los productos del sector.");
        return;
      }

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

      borrarBorrador(appState.sector);
      alert(`Conteo guardado\nEmpleado: ${appState.empleado}\nSector: ${obtenerNombreSectorSeleccionado()}`);
      finalizarConteo();
    } catch (error) {
      console.error(error);

      // Sin conexion: el conteo pasa a la cola local y se reenvia solo.
      const pendiente =
        registros.length && esErrorDeRed(error)
          ? agregarPendiente({
              registros,
              sector_id: appState.sector,
              sector_nombre: obtenerNombreSectorSeleccionado(),
              empleado: appState.empleado,
              creado: ultimaActualizacion,
            })
          : null;

      if (pendiente) {
        borrarBorrador(appState.sector);
        alert(
          `Sin conexion: el conteo de ${pendiente.sector_nombre} quedo guardado en este celular.\n` +
            "Se envia solo cuando vuelva internet. No hace falta volver a contar.",
        );
        finalizarConteo();
        actualizarAvisoPendientes();
        return;
      }

      // Lo tipeado sigue en pantalla y en el borrador: se puede reintentar.
      alert("Error guardando el conteo. Lo cargado no se perdio: reintenta Guardar.");
    } finally {
      guardando = false;
    }
  }

  async function procesarPendientes() {
    if (enviandoPendientes || !leerPendientes().length) return;

    enviandoPendientes = true;

    try {
      const { enviados, descartados, fallidos, error } = await enviarPendientes({
        getInventarioSector,
        guardarInventario,
      });

      if (error) console.error(error);

      actualizarAvisoPendientes();

      if (descartados.length) {
        alert(
          descartados
            .map(
              (item) =>
                `No se envio el conteo de ${item.sector_nombre} (${item.empleado}, ${formatearHora(item.creado)}): ` +
                "ese sector ya tiene un conteo mas nuevo.",
            )
            .join("\n"),
        );
      }

      if (fallidos.length) {
        alert(
          fallidos
            .map(
              (item) =>
                `No se pudo enviar el conteo de ${item.sector_nombre} (${item.empleado}, ${formatearHora(item.creado)}): ` +
                `${item.motivo}. Hay que volver a contarlo.`,
            )
            .join("\n"),
        );
      }

      if (enviados.length && !leerPendientes().length) {
        mostrarAviso(
          "ok",
          enviados.length === 1
            ? `✅ Se envio el conteo pendiente de ${enviados[0].sector_nombre}.`
            : `✅ Se enviaron ${enviados.length} conteos pendientes.`,
        );
      }
    } finally {
      enviandoPendientes = false;
    }
  }

  async function manejarCambioEmpleado() {
    try {
      appState.setEmpleado(obtenerEmpleadoSeleccionado());
      guardarEmpleadoLocal();

      if (!validarSeleccion()) return;

      // Cambiar de empleado con el sector ya cargado no recarga (no se pierden cambios).
      if (sectorRenderizado === appState.sector) {
        return;
      }

      await renderizarYCargar();
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
        "Hay cambios sin guardar. Si cambias de sector se perderan. Continuar?",
      );

      if (!confirmar) {
        appState.rollbackSector();
        reflejarSectorActual();
        return;
      }

      borrarBorrador(appState.sectorAnterior);
    }

    if (!validarSeleccion()) return;

    try {
      await renderizarYCargar();
    } catch (error) {
      console.error(error);
      alert("Error cargando el stock del sector");

      appState.rollbackSector();
      reflejarSectorActual();

      if (validarSeleccion()) {
        await renderizarYCargar();
      }
    }
  }

  async function compartirStock(abrirWhatsapp) {
    const { categorias, productos } = obtenerCatalogoRenderizable();
    const data = await buildStockData(productos, categorias);
    const texto = formatWhatsappText(data, productos);

    if (abrirWhatsapp) {
      const url =
        "https://api.whatsapp.com/send?text=" + encodeURIComponent(texto);

      window.open(url, "_blank");
      return;
    }

    await navigator.clipboard.writeText(texto);
    alert("Copiado al portapapeles");
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
      window.location.href = "supervisor.html";
    });
  }

  // Si fallan los empleados se usa la ultima lista guardada en el celular
  // (mas el empleado que ya estaba elegido), asi se puede contar igual.
  function empleadosDeRespaldo() {
    const empleados = leerEmpleadosCache();
    const guardado = leerEmpleadoGuardado();

    if (guardado && !empleados.some(({ nombre }) => nombre === guardado)) {
      empleados.push({ nombre: guardado });
    }

    return empleados;
  }

  // Al abrir la app, vuelve al sector que quedo con un conteo sin guardar.
  async function restaurarBorrador() {
    const borrador = leerUltimoBorrador();

    if (!borrador) return;

    const existeSector = (appState.sectores || []).some(
      (sector) => String(sector.id) === borrador.sector_id,
    );

    if (!existeSector) {
      borrarBorrador(borrador.sector_id);
      return;
    }

    const existeEmpleado = Array.from(selectEmpleado.options).some(
      (option) => option.value && option.value === borrador.empleado,
    );

    // Se retoma con el empleado que lo estaba contando.
    if (existeEmpleado && appState.empleado !== borrador.empleado) {
      appState.setEmpleado(borrador.empleado);
      selectEmpleado.value = borrador.empleado;
      guardarEmpleadoLocal();
    }

    appState.setSector(borrador.sector_id);
    reflejarSectorActual();

    // Sin empleado elegido, el borrador se aplica cuando lo elijan.
    if (!validarSeleccion()) return;

    try {
      await renderizarYCargar();
    } catch (error) {
      // El borrador queda guardado para el proximo intento.
      console.error(error);
      sectorRenderizado = null;
      appState.resetSector();
      reflejarSectorActual();
      validarSeleccion();
    }
  }

  async function init() {
    try {
      listaProductos.style.display = "none";

      const empleadosPromesa = getEmpleados().then(
        (lista) => {
          guardarEmpleadosCache(lista);
          return lista;
        },
        (error) => {
          console.error(error);
          return null;
        },
      );

      const [sectores, productos, categorias] = await Promise.all([
        getSectores(),
        getProductos(),
        getCategorias(),
      ]);

      const empleados = await empleadosPromesa;

      cargarEmpleados(empleados ?? empleadosDeRespaldo());
      cargarEmpleadoLocal();

      appState.setCatalogo({ sectores, productos, categorias });

      renderSectores(selectSector, appState.sectores);
      validarSeleccion();

      if (!empleados) {
        mostrarAviso(
          "info",
          "No se pudo actualizar la lista de empleados: se muestra la ultima guardada.",
        );
      }

      await restaurarBorrador();
    } catch (error) {
      console.error(error);
      listaProductos.style.display = "block";
      listaProductos.innerHTML = "Error cargando la aplicacion";
    }

    // Si ya hay un aviso temporal, el de pendientes aparece cuando ese se va.
    if (!avisoStock || avisoStock.hidden) {
      actualizarAvisoPendientes();
    }

    procesarPendientes();
  }

  window.addEventListener("online", procesarPendientes);
  setInterval(procesarPendientes, 30000);

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
      const { categorias, productos } = obtenerCatalogoRenderizable();
      const data = await buildStockData(productos, categorias);

      try {
        await guardarSnapshotSiCorresponde(data);
      } catch (error) {
        console.error(error);
      }

      const texto = formatWhatsappText(data, productos);
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
