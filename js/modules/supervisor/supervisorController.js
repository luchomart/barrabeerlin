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
  getSupervisorUser,
  onSupervisorAuthChange,
  signInSupervisor,
  signOutSupervisor,
} from "../../services/authService.js";

import {
  buildStockChangesReport,
  buildStockData,
  formatPlainText,
} from "../stock/stockFormatter.js";

import {
  renderSupervisorAuthPanel,
  renderSupervisorCambios,
  renderSupervisorConteos,
  renderSupervisorError,
  renderSupervisorEstadoSectores,
  renderSupervisorLoader,
} from "../../ui/renderer.js";

const SUPERVISOR_EMAIL_STORAGE_KEY = "stock-barra:supervisor-email";

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

function leerEmailSupervisorGuardado() {
  return localStorage.getItem(SUPERVISOR_EMAIL_STORAGE_KEY) || "";
}

function guardarEmailSupervisor(email) {
  const value = String(email || "").trim();

  if (!value) {
    localStorage.removeItem(SUPERVISOR_EMAIL_STORAGE_KEY);
    return;
  }

  localStorage.setItem(SUPERVISOR_EMAIL_STORAGE_KEY, value);
}

function obtenerMensajeAuth(error) {
  const mensaje = String(error?.message || "").toLowerCase();

  if (!mensaje) {
    return "No se pudo iniciar sesion de supervisor.";
  }

  if (
    mensaje.includes("invalid login credentials") ||
    mensaje.includes("invalid_credentials")
  ) {
    return "Email o contrasena incorrectos.";
  }

  if (mensaje.includes("email not confirmed")) {
    return "La cuenta de supervisor todavia no confirmo su email.";
  }

  if (mensaje.includes("network")) {
    return "No se pudo conectar con el servicio de autenticacion.";
  }

  return "No se pudo iniciar sesion de supervisor.";
}

export function initSupervisorApp() {
  const authShellExistente = document.getElementById("supervisor-auth-shell");
  const accionesSupervisor = document.querySelector(".acciones-supervisor");
  const listaConteos = document.getElementById("lista-conteos");
  const estadoSectores = document.getElementById("estado-sectores");
  const listaCambiosStock = document.getElementById("lista-cambios-stock");
  const btnRecargar = document.getElementById("btn-recargar");
  const btnVolver = document.getElementById("btn-volver");
  const btnWhatsapp = document.getElementById("btn-whatsapp");
  const seccionesSupervisor = Array.from(
    document.querySelectorAll(".supervisor-section"),
  );

  const authShell =
    authShellExistente ||
    (() => {
      const section = document.createElement("section");
      section.id = "supervisor-auth-shell";
      section.className = "supervisor-auth-shell";
      accionesSupervisor?.before(section);
      return section;
    })();

  let autoRefreshId = null;
  let authListenerCleanup = null;
  let authLoading = false;
  let supervisorHabilitado = false;
  let emailSupervisor = leerEmailSupervisorGuardado();

  function actualizarVisibilidadSupervisor(visible) {
    supervisorHabilitado = visible;

    seccionesSupervisor.forEach((section) => {
      section.hidden = !visible;
    });

    [btnRecargar, btnWhatsapp].forEach((button) => {
      if (!button) return;

      button.hidden = !visible;
      button.disabled = !visible;
    });

    accionesSupervisor?.classList.toggle("acciones-supervisor-bloqueado", !visible);
  }

  function renderAuthLogin(message = "") {
    renderSupervisorAuthPanel(authShell, {
      mode: "login",
      email: emailSupervisor,
      message,
      loading: authLoading,
    });
  }

  function renderAuthActiva(user) {
    renderSupervisorAuthPanel(authShell, {
      mode: "session",
      userEmail: user?.email || "",
    });
  }

  function renderAuthError(message) {
    renderSupervisorAuthPanel(authShell, {
      mode: "error",
      message,
    });
  }

  function detenerAutoRefresh() {
    if (!autoRefreshId) return;

    clearInterval(autoRefreshId);
    autoRefreshId = null;
  }

  function iniciarAutoRefresh() {
    detenerAutoRefresh();
    autoRefreshId = window.setInterval(() => {
      if (!supervisorHabilitado) return;

      actualizarSupervisor();
    }, 30000);
  }

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

      const cambios = buildStockChangesReport(diferencias, productos);

      renderSupervisorCambios(listaCambiosStock, cambios);
    } catch (error) {
      console.error(error);
      renderSupervisorError(listaCambiosStock, "Error cargando cambios");
    }
  }

  async function actualizarSupervisor() {
    if (!supervisorHabilitado) {
      return;
    }

    await Promise.all([cargarResumen(), cargarCambiosStock()]);
  }

  async function detectarErrores() {
    if (!supervisorHabilitado) {
      return;
    }

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
    if (!supervisorHabilitado) {
      return;
    }

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

  async function resolverAccesoSupervisor({ mostrarLoader = true } = {}) {
    detenerAutoRefresh();
    actualizarVisibilidadSupervisor(false);

    if (mostrarLoader) {
      renderSupervisorAuthPanel(authShell, {
        mode: "loading",
        message: "Verificando sesion de supervisor...",
      });
    }

    try {
      const user = await getSupervisorUser();

      authLoading = false;

      if (!user) {
        renderAuthLogin();
        return;
      }

      if (user.email) {
        emailSupervisor = user.email;
        guardarEmailSupervisor(user.email);
      }

      renderAuthActiva(user);
      actualizarVisibilidadSupervisor(true);
      iniciarAutoRefresh();

      await actualizarSupervisor();
      await detectarErrores();
    } catch (error) {
      console.error(error);
      authLoading = false;
      renderAuthError("No se pudo verificar la sesion del supervisor.");
    }
  }

  authShell.addEventListener("submit", async (event) => {
    if (event.target.id !== "supervisor-login-form") {
      return;
    }

    event.preventDefault();

    if (authLoading) {
      return;
    }

    const formData = new FormData(event.target);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    emailSupervisor = email;
    guardarEmailSupervisor(email);
    authLoading = true;
    renderAuthLogin();

    try {
      await signInSupervisor({ email, password });
      await resolverAccesoSupervisor({ mostrarLoader: false });
    } catch (error) {
      console.error(error);
      authLoading = false;
      renderAuthLogin(obtenerMensajeAuth(error));
    }
  });

  authShell.addEventListener("click", async (event) => {
    const logoutButton = event.target.closest("#btn-cerrar-sesion-supervisor");
    const retryButton = event.target.closest("#btn-reintentar-auth");

    if (retryButton) {
      await resolverAccesoSupervisor();
      return;
    }

    if (!logoutButton || authLoading) {
      return;
    }

    authLoading = true;
    renderSupervisorAuthPanel(authShell, {
      mode: "loading",
      message: "Cerrando sesion de supervisor...",
    });

    try {
      await signOutSupervisor();
      authLoading = false;
      renderAuthLogin();
    } catch (error) {
      console.error(error);
      authLoading = false;
      renderAuthError("No se pudo cerrar la sesion del supervisor.");
    }
  });

  btnVolver.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  btnRecargar.addEventListener("click", () => {
    actualizarSupervisor();
  });
  btnWhatsapp.addEventListener("click", enviarStockWhatsapp);

  authListenerCleanup = onSupervisorAuthChange((event) => {
    if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "TOKEN_REFRESHED") {
      return;
    }

    window.setTimeout(() => {
      resolverAccesoSupervisor({ mostrarLoader: false });
    }, 0);
  });

  window.addEventListener("beforeunload", () => {
    detenerAutoRefresh();
    authListenerCleanup?.();
  });

  resolverAccesoSupervisor();
}
