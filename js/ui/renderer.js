export function renderSectores(selectSector, sectores) {
  selectSector.innerHTML = "";

  const optionInicial = document.createElement("option");
  optionInicial.value = "";
  optionInicial.textContent = "Seleccionar...";
  optionInicial.disabled = true;
  optionInicial.selected = true;

  selectSector.appendChild(optionInicial);

  sectores.forEach((sector) => {
    const option = document.createElement("option");

    option.value = sector.id;
    option.textContent = sector.nombre;

    selectSector.appendChild(option);
  });
}

export function renderProductos(
  listaProductos,
  categorias,
  productos,
  onInput,
) {
  listaProductos.innerHTML = "";

  categorias.forEach((categoria) => {
    const productosCategoria = productos.filter(
      (producto) => Number(producto.categoria_id) === Number(categoria.id),
    );

    if (!productosCategoria.length) return;

    const contenedor = document.createElement("div");
    contenedor.className = "categoria-bloque";

    const titulo = document.createElement("div");
    titulo.className = "categoria-titulo";
    titulo.innerHTML = `
      <div class="categoria-left">
        <span class="categoria-arrow">▶</span>
        <span>${categoria.nombre}</span>
        <span class="categoria-count">(${productosCategoria.length})</span>
      </div>
    `;

    const productosDiv = document.createElement("div");
    productosDiv.className = "categoria-productos categoria-cerrada";

    titulo.addEventListener("click", () => {
      const abierta = titulo.classList.contains("categoria-abierta");

      document.querySelectorAll(".categoria-productos").forEach((elemento) => {
        elemento.classList.add("categoria-cerrada");
      });

      document.querySelectorAll(".categoria-titulo").forEach((elemento) => {
        elemento.classList.remove("categoria-abierta");
      });

      if (!abierta) {
        productosDiv.classList.remove("categoria-cerrada");
        titulo.classList.add("categoria-abierta");
      }
    });

    productosCategoria.forEach((producto) => {
      const fila = document.createElement("div");
      fila.className = "producto-fila";
      fila.dataset.nombre = producto.nombre.toLowerCase();
      fila.innerHTML = `
        <span class="producto-nombre">${producto.nombre}</span>
        <input type="number" min="0" value="0" data-id="${producto.id}">
      `;

      const input = fila.querySelector("input");
      let valorAnterior = input.value;

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

  data.forEach((registro) => {
    mapa[registro.producto_id] = registro.cantidad;
  });

  document.querySelectorAll("#lista-productos input").forEach((input) => {
    const productoId = input.dataset.id;

    input.value = mapa[productoId] ?? 0;
    input.classList.remove("input-modificado");
  });
}

export function renderSupervisorLoader(container, texto) {
  container.innerHTML = `
    <div class="loader supervisor-loader">
      <span class="supervisor-loader-spinner"></span>
      <span>${texto}</span>
    </div>
  `;
}

export function renderSupervisorError(container, texto) {
  container.innerHTML = `
    <div class="supervisor-empty supervisor-empty-error">
      <strong>⚠ ${texto}</strong>
    </div>
  `;
}

export function renderSupervisorConteos(listaConteos, conteos) {
  if (!conteos.length) {
    listaConteos.innerHTML = `
      <div class="supervisor-empty">
        <strong>Sin conteos hoy</strong>
        <p>Todavia no se registraron movimientos en esta jornada.</p>
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
        <span class="supervisor-tag supervisor-tag-user">👤 Empleado</span>
        <span class="supervisor-time">🕒 ${fecha.toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
        })}</span>
      </div>
      <h3>${conteo.empleado}</h3>
      <div class="supervisor-card-meta">
        <span class="supervisor-chip">📦 ${conteo.sectores?.nombre || "Sector"}</span>
        <span class="supervisor-chip supervisor-chip-muted">Ultimo conteo</span>
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
  const contados = sectores.filter((sector) => sectoresContados.has(sector.id));
  const pendientes = sectores.length - contados.length;

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

  sectores.forEach((sector) => {
    const contado = sectoresContados.has(sector.id);
    const div = document.createElement("div");

    div.className = `supervisor-status-row ${
      contado ? "supervisor-status-ok" : "supervisor-status-pending"
    }`;
    div.innerHTML = `
      <div class="supervisor-status-main">
        <span class="supervisor-status-icon">${contado ? "✅" : "❌"}</span>
        <strong>${sector.nombre}</strong>
      </div>
      <span class="supervisor-status-label">${
        contado ? "Contado" : "Pendiente"
      }</span>
    `;

    lista.appendChild(div);
  });

  estadoSectores.appendChild(lista);
}

export function renderSupervisorCambios(listaCambios, textoCambios) {
  const lineas = String(textoCambios || "")
    .split("\n")
    .map((linea) => linea.trim())
    .filter(Boolean);

  const items = lineas.slice(1);

  if (!items.length || items[0] === "Sin cambios") {
    listaCambios.innerHTML = `
      <div class="supervisor-empty">
        <strong>Sin cambios relevantes</strong>
        <p>Cuando haya movimientos entre snapshots los vas a ver aca.</p>
      </div>
    `;
    return;
  }

  listaCambios.innerHTML = "";

  items.forEach((item) => {
    const esSuba = item.startsWith("📈");
    const div = document.createElement("div");

    div.className = `supervisor-change-row ${
      esSuba ? "supervisor-change-up" : "supervisor-change-down"
    }`;
    div.innerHTML = `
      <span class="supervisor-change-icon">${esSuba ? "📈" : "📉"}</span>
      <span class="supervisor-change-text">${item.replace(/^[📈📉]\s*/, "")}</span>
    `;

    listaCambios.appendChild(div);
  });
}
