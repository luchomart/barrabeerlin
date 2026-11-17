const ICONOS = {
  cambioNeutral: "\u2696\uFE0F",
};

export function escapeHtml(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function formatearDiferencia(valor) {
  const numero = Number(valor) || 0;

  return `${numero > 0 ? "+" : ""}${numero}`;
}

function crearFilaCambio(item) {
  const div = document.createElement("div");
  const nombre = escapeHtml(item.nombre);
  let texto = nombre;
  let claseExtra = "supervisor-change-neutral";

  if (item.tipo === "entrada") {
    texto = `${nombre}: +${escapeHtml(item.diferencia)}`;
    claseExtra = "supervisor-change-up";
  } else if (item.tipo === "salida") {
    texto = `${nombre}: ${escapeHtml(item.diferencia)}`;
    claseExtra = "supervisor-change-down";
  }

  div.className = `supervisor-change-row ${claseExtra}`;
  div.innerHTML = `
    <span class="supervisor-change-icon" aria-hidden="true">${item.icono}</span>
    <span class="supervisor-change-text">${texto}</span>
  `;

  return div;
}

function crearGrupoCambios(titulo, claseTitulo, items = []) {
  const bloque = document.createElement("div");
  bloque.className = "supervisor-change-group";

  const encabezado = document.createElement("div");
  encabezado.className = `supervisor-change-group-title ${claseTitulo}`;
  encabezado.textContent = titulo;

  const lista = document.createElement("div");
  lista.className = "supervisor-change-group-list";

  items.forEach((item) => {
    lista.appendChild(crearFilaCambio(item));
  });

  bloque.appendChild(encabezado);
  bloque.appendChild(lista);

  return bloque;
}

function perteneceACategoria(producto, categoria) {
  return String(producto?.categoria_id) === String(categoria?.id);
}

export function renderSectores(selectSector, sectores) {
  selectSector.innerHTML = "";

  const optionInicial = document.createElement("option");
  optionInicial.value = "";
  optionInicial.textContent = "Elegí…";
  optionInicial.disabled = true;
  optionInicial.selected = true;

  selectSector.appendChild(optionInicial);

  (Array.isArray(sectores) ? sectores : []).forEach((sector) => {
    const option = document.createElement("option");

    option.value = sector.id;
    option.textContent = sector.nombre;

    selectSector.appendChild(option);
  });
}

const ICONO_CHECK =
  '<svg class="icono" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
  '<path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round"/></svg>';

const CANTIDAD_MAXIMA = 1000;

const ICONO_MENOS =
  '<svg class="icono" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
  '<path d="M3.5 8h9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

const ICONO_MAS =
  '<svg class="icono" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
  '<path d="M3.5 8h9M8 3.5v9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

const ICONO_FLECHA =
  '<svg class="icono categoria-arrow" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
  '<path d="M6 3.5l4.5 4.5L6 12.5" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round"/></svg>';

// Una categoria queda "revisada" cuando se abre o se toca alguno de sus productos.
export function marcarCategoriaRevisada(bloque) {
  if (!bloque || bloque.classList.contains("categoria-revisada")) return;

  bloque.classList.add("categoria-revisada");

  const estado = bloque.querySelector(".categoria-estado");

  if (estado) {
    estado.hidden = false;
  }
}

export function renderProductos(
  listaProductos,
  categorias,
  productos,
  onInput,
  onCategoriaAbierta = () => {},
) {
  listaProductos.innerHTML = "";

  (Array.isArray(categorias) ? categorias : []).forEach((categoria) => {
    const productosCategoria = (Array.isArray(productos) ? productos : []).filter(
      (producto) => perteneceACategoria(producto, categoria),
    );

    if (!productosCategoria.length) return;

    const contenedor = document.createElement("div");
    contenedor.className = "categoria-bloque";

    const titulo = document.createElement("button");
    titulo.type = "button";
    titulo.className = "categoria-titulo";
    titulo.setAttribute("aria-expanded", "false");
    titulo.innerHTML = `
      <span class="categoria-left">
        ${ICONO_FLECHA}
        <span class="categoria-nombre">${escapeHtml(categoria.nombre)}</span>
        <span class="categoria-count" aria-label="${productosCategoria.length} productos">${productosCategoria.length}</span>
      </span>
      <span class="categoria-estado" hidden>${ICONO_CHECK}<span>Revisada</span></span>
    `;

    const productosDiv = document.createElement("div");
    productosDiv.className = "categoria-productos categoria-cerrada";

    titulo.addEventListener("click", () => {
      const abierta = titulo.classList.contains("categoria-abierta");

      productosDiv.classList.toggle("categoria-cerrada", abierta);
      titulo.classList.toggle("categoria-abierta", !abierta);
      titulo.setAttribute("aria-expanded", String(!abierta));

      if (!abierta) {
        marcarCategoriaRevisada(contenedor);
        onCategoriaAbierta(contenedor);
      }
    });

    productosCategoria.forEach((producto) => {
      const nombre = escapeHtml(producto.nombre);
      const fila = document.createElement("div");
      fila.className = "producto-fila";
      fila.dataset.nombre = String(producto.nombre || "").toLowerCase();
      fila.innerHTML = `
        <span class="producto-nombre">${nombre}</span>
        <span class="cantidad-control">
          <button type="button" class="btn-cantidad" data-paso="-1" aria-label="Restar uno a ${nombre}">${ICONO_MENOS}</button>
          <input type="number" inputmode="numeric" min="0" max="${CANTIDAD_MAXIMA}" value="0"
            data-id="${escapeHtml(producto.id)}" aria-label="Cantidad de ${nombre}">
          <button type="button" class="btn-cantidad" data-paso="1" aria-label="Sumar uno a ${nombre}">${ICONO_MAS}</button>
        </span>
      `;

      const input = fila.querySelector("input");
      let valorAnterior = input.value;

      fila.querySelectorAll(".btn-cantidad").forEach((boton) => {
        boton.addEventListener("click", () => {
          const actual = parseInt(input.value || "0", 10) || 0;
          const siguiente = Math.min(
            CANTIDAD_MAXIMA,
            Math.max(0, actual + Number(boton.dataset.paso)),
          );

          if (siguiente === actual) return;

          input.value = siguiente;
          onInput(input);
        });
      });

      input.addEventListener("focus", () => {
        valorAnterior = input.value;

        setTimeout(() => {
          input.select();
        }, 0);
      });

      input.addEventListener("input", () => {
        onInput(input);
      });

      input.addEventListener("keydown", (event) => {
        if (event.key === "+" || event.key === "=") {
          event.preventDefault();

          let valor = parseInt(input.value || "0", 10);
          valor += 1;

          input.value = valor;
          onInput(input);
          input.select();
        }

        if (event.key === "-") {
          event.preventDefault();

          let valor = parseInt(input.value || "0", 10);

          if (valor > 0) {
            valor -= 1;
          }

          input.value = valor;
          onInput(input);
          input.select();
        }
      });

      input.addEventListener("blur", () => {
        if (input.value === "") {
          input.value = valorAnterior;
        }
      });

      productosDiv.appendChild(fila);
    });

    contenedor.appendChild(titulo);
    contenedor.appendChild(productosDiv);

    listaProductos.appendChild(contenedor);
  });
}

export function actualizarInputsStock(data) {
  const mapa = {};

  (Array.isArray(data) ? data : []).forEach((registro) => {
    mapa[registro.producto_id] = registro.cantidad;
  });

  document.querySelectorAll("#lista-productos input").forEach((input) => {
    const productoId = input.dataset.id;

    input.value = mapa[productoId] ?? 0;
    input.classList.remove("input-modificado");
  });
}

// Aviso de la pantalla de conteo. tipo: "ok" | "info" | "pendiente" | "error". Sin texto, se oculta.
export function renderAvisoStock(elemento, { tipo = "info", texto = "" } = {}) {
  if (!elemento) return;

  elemento.textContent = texto;
  elemento.className = `aviso-stock aviso-stock-${tipo}`;
  elemento.hidden = !texto;
}

// Indicador del header: "cargando" | "en-linea" | "sin-conexion" | "pendiente" | "error".
export function renderEstadoConexion(elemento, estado, texto) {
  if (!elemento) return;

  elemento.dataset.estado = estado;
  elemento.textContent = texto;
}

// Aviso junto a Guardar. acciones: [{ accion, texto, principal }] (botones con data-accion).
// Sin texto, se oculta.
export function renderAvisoGuardar(
  elemento,
  { tipo = "atencion", texto = "", acciones = [] } = {},
) {
  if (!elemento) return;

  elemento.hidden = !texto;
  elemento.className = `aviso-guardar aviso-guardar-${tipo}`;

  if (!texto) {
    elemento.innerHTML = "";
    return;
  }

  const botones = acciones
    .map(
      ({ accion, texto: etiqueta, principal }) =>
        `<button type="button" data-accion="${escapeHtml(accion)}"${
          principal ? ' class="aviso-guardar-principal"' : ""
        }>${escapeHtml(etiqueta)}</button>`,
    )
    .join("");

  elemento.innerHTML = `
    <p>${escapeHtml(texto)}</p>
    ${botones ? `<div class="aviso-guardar-acciones">${botones}</div>` : ""}
  `;
}

// Comprobante que queda en pantalla despues de guardar. tipo: "ok" | "pendiente". Sin datos, se oculta.
export function renderComprobante(elemento, datos = null) {
  if (!elemento) return;

  if (!datos) {
    elemento.hidden = true;
    elemento.innerHTML = "";
    return;
  }

  const { tipo = "ok", sector = "", hora = "", empleado = "", productos = 0 } = datos;
  const pendiente = tipo === "pendiente";
  const detalle = [hora, empleado, `${productos} ${productos === 1 ? "producto" : "productos"}`]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" · ");

  elemento.className = `comprobante comprobante-${pendiente ? "pendiente" : "ok"}`;
  elemento.hidden = false;
  elemento.innerHTML = `
    <div class="comprobante-cabecera">
      <span class="comprobante-icono">${ICONO_CHECK}</span>
      <div>
        <strong>${escapeHtml(sector)} ${pendiente ? "quedó guardado en este celular" : "guardado"}</strong>
        <span class="comprobante-detalle">${detalle}</span>
      </div>
    </div>
    ${
      pendiente
        ? '<p class="comprobante-nota">Se envía solo cuando vuelva internet. No hace falta volver a contar.</p>'
        : ""
    }
    <div class="comprobante-acciones">
      <button type="button" data-accion="whatsapp">Enviar stock por WhatsApp</button>
      <span class="comprobante-siguiente">Para seguir, elegí otro sector.</span>
    </div>
  `;
}

export function renderErrorCarga(elemento, texto) {
  if (!elemento) return;

  elemento.innerHTML = `
    <div class="error-carga" role="alert">
      <strong>${escapeHtml(texto)}</strong>
      <p>Revisá la conexión del celular y volvé a intentar.</p>
      <button type="button" id="btn-reintentar-carga">Reintentar</button>
    </div>
  `;
}

export function renderSupervisorLoader(container, texto) {
  container.innerHTML = `
    <div class="supervisor-loader">
      <span class="supervisor-loader-spinner"></span>
      <span>${escapeHtml(texto)}</span>
    </div>
  `;
}

export function renderSupervisorError(container, texto) {
  container.innerHTML = `
    <div class="supervisor-empty supervisor-empty-error">
      <strong>${escapeHtml(texto)}</strong>
      <p>Reintentá con Actualizar o volvé a cargar la página.</p>
    </div>
  `;
}

export function renderSupervisorAuthPanel(container, state = {}) {
  const {
    mode = "login",
    email = "",
    message = "",
    loading = false,
    userEmail = "",
  } = state;

  if (mode === "loading") {
    container.innerHTML = `
      <div class="supervisor-auth-card">
        <div class="supervisor-loader">
          <span class="supervisor-loader-spinner"></span>
          <span>${escapeHtml(message || "Verificando acceso...")}</span>
        </div>
      </div>
    `;
    return;
  }

  if (mode === "error") {
    container.innerHTML = `
      <div class="supervisor-auth-card supervisor-auth-card-error">
        <div class="supervisor-auth-copy">
          <h2>No se pudo validar la sesión</h2>
          <p>${escapeHtml(message || "Reintentá en unos segundos.")}</p>
        </div>
        <div class="supervisor-auth-actions">
          <button id="btn-reintentar-auth" type="button">Reintentar</button>
        </div>
      </div>
    `;
    return;
  }

  if (mode === "session") {
    container.innerHTML = `
      <div class="supervisor-auth-card supervisor-auth-card-session">
        <div class="supervisor-auth-copy">
          <h2>Sesión de supervisor</h2>
          <p>${escapeHtml(userEmail || "Cuenta de supervisor activa")}</p>
        </div>
        <div class="supervisor-auth-actions">
          <button id="btn-cerrar-sesion-supervisor" type="button">
            Cerrar sesión
          </button>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="supervisor-auth-card">
      <div class="supervisor-auth-copy">
        <h2>Ingresar al panel</h2>
        <p>Entrá con la cuenta de supervisor.</p>
      </div>
      <form id="supervisor-login-form" class="supervisor-auth-form" autocomplete="on">
        <label class="supervisor-auth-field" for="supervisor-login-email">
          <span>Email</span>
          <input
            id="supervisor-login-email"
            name="email"
            type="email"
            inputmode="email"
            autocomplete="username"
            placeholder="supervisor@tu-dominio.com"
            value="${escapeHtml(email)}"
            ${loading ? "disabled" : ""}
            required
          />
        </label>
        <label class="supervisor-auth-field" for="supervisor-login-password">
          <span>Contraseña</span>
          <input
            id="supervisor-login-password"
            name="password"
            type="password"
            autocomplete="current-password"
            ${loading ? "disabled" : ""}
            required
          />
        </label>
        ${
          message
            ? `<div class="supervisor-auth-message supervisor-auth-message-error">${escapeHtml(message)}</div>`
            : ""
        }
        <button id="supervisor-login-submit" type="submit" ${loading ? "disabled" : ""}>
          ${loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  `;
}

export function renderSupervisorConteos(listaConteos, conteos) {
  if (!Array.isArray(conteos) || !conteos.length) {
    listaConteos.innerHTML = `
      <div class="supervisor-empty">
        <strong>Sin conteos hoy</strong>
        <p>Todavía no se registraron conteos en esta jornada.</p>
      </div>
    `;
    return;
  }

  listaConteos.innerHTML = "";

  conteos.forEach((conteo) => {
    const fecha = new Date(conteo.ultima_actualizacion);
    const div = document.createElement("div");

    div.className = "supervisor-card supervisor-conteo-card";
    div.innerHTML = `
      <div class="supervisor-card-header">
        <h3>${escapeHtml(conteo.empleado || "Sin empleado")}</h3>
        <span class="supervisor-time">${fecha.toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })}</span>
      </div>
      <div class="supervisor-card-meta">
        <span class="supervisor-chip">${escapeHtml(conteo.sectores?.nombre || "Sector")}</span>
      </div>
    `;

    listaConteos.appendChild(div);
  });
}

export function renderSupervisorEstadoSectores(
  estadoSectores,
  sectores,
  sectoresContados,
) {
  const listaSectores = Array.isArray(sectores) ? sectores : [];
  const contados = listaSectores.filter((sector) => sectoresContados.has(sector.id));
  const pendientes = listaSectores.length - contados.length;

  estadoSectores.innerHTML = `
    <div class="supervisor-summary">
      <div class="supervisor-summary-card supervisor-summary-ok">
        <span class="supervisor-summary-value">${contados.length}</span>
        <span class="supervisor-summary-label">Contados</span>
      </div>
      <div class="supervisor-summary-card supervisor-summary-pending">
        <span class="supervisor-summary-value">${pendientes}</span>
        <span class="supervisor-summary-label">Pendientes</span>
      </div>
    </div>
  `;

  const lista = document.createElement("div");
  lista.className = "supervisor-status-list";

  listaSectores.forEach((sector) => {
    const contado = sectoresContados.has(sector.id);
    const div = document.createElement("div");

    div.className = `supervisor-status-row ${
      contado ? "supervisor-status-ok" : "supervisor-status-pending"
    }`;
    div.innerHTML = `
      <div class="supervisor-status-main">
        <span class="supervisor-status-icon" aria-hidden="true"></span>
        <strong>${escapeHtml(sector.nombre)}</strong>
      </div>
      <span class="supervisor-status-label">${contado ? "Contado" : "Pendiente"}</span>
    `;

    lista.appendChild(div);
  });

  estadoSectores.appendChild(lista);
}

export function renderSupervisorCambios(listaCambios, reporte) {
  if (!reporte || typeof reporte !== "object") {
    listaCambios.innerHTML = `
      <div class="supervisor-empty">
        <strong>Sin datos de cambios</strong>
        <p>No se pudo preparar el análisis del stock total.</p>
      </div>
    `;
    return;
  }

  const {
    entradas = [],
    salidas = [],
    sinCambios = [],
    totalEntradas = 0,
    totalSalidas = 0,
    tieneComparacion = false,
    hayCambios = false,
  } = reporte;

  if (!tieneComparacion) {
    listaCambios.innerHTML = `
      <div class="supervisor-empty">
        <strong>Todavía no hay con qué comparar</strong>
        <p>Hacen falta dos capturas del stock total. Se guarda una cada vez que se envía el stock por WhatsApp desde la pantalla de conteo.</p>
      </div>
    `;
    return;
  }

  listaCambios.innerHTML = `
    <div class="supervisor-summary supervisor-change-summary">
      <div class="supervisor-summary-card supervisor-summary-pending">
        <span class="supervisor-summary-value">${formatearDiferencia(totalSalidas)}</span>
        <span class="supervisor-summary-label">Salida total</span>
      </div>
      <div class="supervisor-summary-card supervisor-summary-ok">
        <span class="supervisor-summary-value">${formatearDiferencia(totalEntradas)}</span>
        <span class="supervisor-summary-label">Entrada total</span>
      </div>
    </div>
  `;

  if (!hayCambios) {
    const empty = document.createElement("div");
    empty.className = "supervisor-empty";
    empty.innerHTML = `
      <strong>Sin cambios desde la última captura</strong>
      <p>El stock total se mantuvo igual entre las dos últimas capturas.</p>
    `;

    listaCambios.appendChild(empty);
    return;
  }

  const grupos = document.createElement("div");
  grupos.className = "supervisor-change-groups";

  if (salidas.length) {
    grupos.appendChild(
      crearGrupoCambios("SALIDAS", "supervisor-change-group-title-down", salidas),
    );
  }

  if (entradas.length) {
    grupos.appendChild(
      crearGrupoCambios("ENTRADAS", "supervisor-change-group-title-up", entradas),
    );
  }

  if (sinCambios.length) {
    const itemsSinCambios = sinCambios.map((item) => ({
      ...item,
      icono: ICONOS.cambioNeutral,
      tipo: "sin_cambio",
    }));

    grupos.appendChild(
      crearGrupoCambios(
        "SIN CAMBIOS",
        "supervisor-change-group-title-neutral",
        itemsSinCambios,
      ),
    );
  }

  listaCambios.appendChild(grupos);
}

export function renderAppVersionBadge(version) {
  const versionNormalizada = String(version || "").trim();

  if (!versionNormalizada) return;

  const versionLabel = versionNormalizada.startsWith("v")
    ? versionNormalizada
    : `v${versionNormalizada}`;

  let badge = document.querySelector("[data-app-version]");

  if (!badge) {
    badge = document.createElement("div");
    badge.className = "app-version-badge";
    badge.dataset.appVersion = "true";
  }

  badge.textContent = versionLabel;

  const target =
    document.querySelector("[data-version-slot]") ||
    document.querySelector("footer") ||
    document.querySelector(".container") ||
    document.body;

  target.appendChild(badge);
}
