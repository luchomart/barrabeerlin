import { formatearCantidad } from "../utils/format.js";
import { escapeHtml } from "./renderer.js";

const SIN_CATEGORIA_ID = "sin-categoria";

function ordenarPorNombre(lista = []) {
  return [...lista].sort((a, b) =>
    String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es"),
  );
}

function ordenarProductos(lista = []) {
  return [...lista].sort((a, b) => {
    const ordenA = a?.orden ?? Number.MAX_SAFE_INTEGER;
    const ordenB = b?.orden ?? Number.MAX_SAFE_INTEGER;

    if (ordenA !== ordenB) return ordenA - ordenB;

    return String(a?.nombre || "").localeCompare(String(b?.nombre || ""), "es");
  });
}

// Agrupa productos por categoria. Los que no tienen una categoria valida
// quedan en un grupo "Sin categoria" (hoy no aparecen en ningun sector).
export function agruparProductosPorCategoria(categorias = [], productos = []) {
  const listaCategorias = ordenarPorNombre(Array.isArray(categorias) ? categorias : []);
  const idsValidos = new Set(listaCategorias.map((categoria) => String(categoria.id)));
  const listaProductos = Array.isArray(productos) ? productos : [];

  const grupos = listaCategorias.map((categoria) => ({
    id: String(categoria.id),
    nombre: categoria.nombre,
    productos: ordenarProductos(
      listaProductos.filter(
        (producto) => String(producto?.categoria_id) === String(categoria.id),
      ),
    ),
  }));

  const sinCategoria = ordenarProductos(
    listaProductos.filter(
      (producto) => !idsValidos.has(String(producto?.categoria_id)),
    ),
  );

  if (sinCategoria.length) {
    grupos.push({
      id: SIN_CATEGORIA_ID,
      nombre: "Sin categoría",
      productos: sinCategoria,
      sinCategoria: true,
    });
  }

  return grupos;
}

function botonBorrar(accion, id, nombre, { disabled = false, title = "" } = {}) {
  return `
    <button
      type="button"
      class="admin-borrar"
      data-accion="${accion}"
      data-id="${escapeHtml(id)}"
      data-nombre="${escapeHtml(nombre)}"
      aria-label="Eliminar ${escapeHtml(nombre)}"
      ${title ? `title="${escapeHtml(title)}"` : ""}
      ${disabled ? "disabled" : ""}
    ><svg class="icono" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
  `;
}

const ICONO_MOVER =
  '<svg class="icono" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
  '<path d="M2.5 5.5h10M10 3l2.5 2.5L10 8M13.5 10.5h-10M6 8l-2.5 2.5L6 13" fill="none" ' +
  'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function botonMover(producto) {
  return `
    <button
      type="button"
      class="admin-mover"
      data-accion="mover-producto"
      data-id="${escapeHtml(producto.id)}"
      data-nombre="${escapeHtml(producto.nombre)}"
      aria-label="Mover ${escapeHtml(producto.nombre)} a otra categoría"
      title="Mover a otra categoría"
    >${ICONO_MOVER}</button>
  `;
}

function renderEmpleados(empleados = []) {
  const items = empleados
    .map(
      (empleado) => `
        <li class="admin-item">
          <span class="admin-item-nombre">${escapeHtml(empleado.nombre)}</span>
          ${botonBorrar("eliminar-empleado", empleado.id, empleado.nombre)}
        </li>
      `,
    )
    .join("");

  return `
    <div class="admin-bloque" data-bloque="empleados">
      <h3>Empleados <span class="admin-count">(${empleados.length})</span></h3>
      <ul class="admin-lista">${items || '<li class="admin-vacio">Sin empleados</li>'}</ul>
      <form class="admin-form" data-form="empleado" autocomplete="off">
        <input name="nombre" type="text" maxlength="40" placeholder="Nombre del empleado" aria-label="Nombre del empleado" required />
        <button type="submit">Agregar</button>
      </form>
    </div>
  `;
}

function renderCategorias(grupos = []) {
  const items = grupos
    .filter((grupo) => !grupo.sinCategoria)
    .map((grupo) => {
      const cantidad = grupo.productos.length;

      return `
        <li class="admin-item">
          <span class="admin-item-nombre">${escapeHtml(grupo.nombre)}</span>
          <span class="admin-item-meta">${cantidad} prod.</span>
          ${botonBorrar("eliminar-categoria", grupo.id, grupo.nombre, {
            disabled: cantidad > 0,
            title: cantidad > 0 ? "Tiene productos: borralos primero" : "",
          })}
        </li>
      `;
    })
    .join("");

  return `
    <div class="admin-bloque" data-bloque="categorias">
      <h3>Categorías</h3>
      <ul class="admin-lista">${items || '<li class="admin-vacio">Sin categorías</li>'}</ul>
      <form class="admin-form" data-form="categoria" autocomplete="off">
        <input name="nombre" type="text" maxlength="60" placeholder="Nueva categoría" aria-label="Nombre de la categoría" required />
        <button type="submit">Agregar</button>
      </form>
    </div>
  `;
}

function renderProductos(grupos = [], stockPorProducto = {}, abiertos = new Set()) {
  const opciones = grupos
    .filter((grupo) => !grupo.sinCategoria)
    .map(
      (grupo) =>
        `<option value="${escapeHtml(grupo.id)}">${escapeHtml(grupo.nombre)}</option>`,
    )
    .join("");

  const bloques = grupos
    .filter((grupo) => grupo.productos.length)
    .map((grupo) => {
      const items = grupo.productos
        .map((producto) => {
          const stock = stockPorProducto[String(producto.id)];
          const meta = stock ? `${formatearCantidad(stock.unidades)} u.` : "";

          return `
            <li class="admin-item">
              <span class="admin-item-nombre">${escapeHtml(producto.nombre)}</span>
              <span class="admin-item-meta">${meta}</span>
              ${botonMover(producto)}
              ${botonBorrar("eliminar-producto", producto.id, producto.nombre)}
            </li>
          `;
        })
        .join("");

      return `
        <details class="admin-grupo${grupo.sinCategoria ? " admin-grupo-alerta" : ""}" data-categoria="${escapeHtml(grupo.id)}" ${abiertos.has(grupo.id) ? "open" : ""}>
          <summary>${escapeHtml(grupo.nombre)} <span class="admin-count">(${grupo.productos.length})</span></summary>
          ${grupo.sinCategoria ? '<p class="admin-nota">Estos productos no aparecen en ningún sector.</p>' : ""}
          <ul class="admin-lista">${items}</ul>
        </details>
      `;
    })
    .join("");

  return `
    <div class="admin-bloque" data-bloque="productos">
      <h3>Productos</h3>
      <form class="admin-form admin-form-producto" data-form="producto" autocomplete="off">
        <input name="nombre" type="text" maxlength="80" placeholder="Nombre del producto" aria-label="Nombre del producto" required />
        <select name="categoria_id" aria-label="Categoría del producto" required>
          <option value="" selected disabled>Categoría…</option>
          ${opciones}
        </select>
        <button type="submit">Agregar</button>
      </form>
      ${bloques}
    </div>
  `;
}

// Bloque con los productos marcados con una opcion (lista + selector para marcar otro).
function renderBloqueMarcados(grupos, config) {
  const conCategoria = grupos.filter((grupo) => !grupo.sinCategoria);
  const marcados = conCategoria.flatMap((grupo) =>
    grupo.productos
      .filter(config.estaMarcado)
      .map((producto) => ({ ...producto, categoria: grupo.nombre })),
  );

  const items = marcados
    .map(
      (producto) => `
        <li class="admin-item">
          <span class="admin-item-nombre">${escapeHtml(producto.nombre)}</span>
          <span class="admin-item-meta">${escapeHtml(producto.categoria)}</span>
          <button
            type="button"
            class="admin-borrar"
            data-accion="${config.accionQuitar}"
            data-id="${escapeHtml(producto.id)}"
            data-nombre="${escapeHtml(producto.nombre)}"
            aria-label="${escapeHtml(config.etiquetaQuitar(producto.nombre))}"
          ><svg class="icono" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
        </li>
      `,
    )
    .join("");

  const opciones = conCategoria
    .map((grupo) => {
      const disponibles = grupo.productos.filter(
        (producto) => !config.estaMarcado(producto),
      );

      if (!disponibles.length) return "";

      return `<optgroup label="${escapeHtml(grupo.nombre)}">${disponibles
        .map(
          (producto) =>
            `<option value="${escapeHtml(producto.id)}">${escapeHtml(producto.nombre)}</option>`,
        )
        .join("")}</optgroup>`;
    })
    .join("");

  return `
    <div class="admin-bloque" data-bloque="${config.bloque}">
      <h3>${config.titulo} <span class="admin-count">(${marcados.length})</span></h3>
      <p class="admin-nota">${config.nota}</p>
      <ul class="admin-lista">${items || `<li class="admin-vacio">${config.vacio}</li>`}</ul>
      <form class="admin-form" data-form="${config.bloque}" autocomplete="off">
        <select name="producto_id" aria-label="${config.etiquetaSelect}" required>
          <option value="" selected disabled>Elegí un producto…</option>
          ${opciones}
        </select>
        <button type="submit">Agregar</button>
      </form>
    </div>
  `;
}

// Productos que no aparecen en "Sin stock" del mensaje cuando estan en 0.
function renderSinAviso(grupos = []) {
  return renderBloqueMarcados(grupos, {
    bloque: "sin-aviso",
    titulo: "No avisar si están en 0",
    nota: "No aparecen en «Sin stock» del mensaje de WhatsApp. Si tienen stock, se envían normal.",
    vacio: "Todos los productos avisan.",
    etiquetaSelect: "Producto que no avisa si está en 0",
    accionQuitar: "volver-a-avisar",
    etiquetaQuitar: (nombre) => `Volver a avisar si ${nombre} está en 0`,
    estaMarcado: (producto) => producto.avisar_sin_stock === false,
  });
}

// Productos que se cuentan con decimales (ej. 2,5 botellas abiertas).
function renderDecimales(grupos = []) {
  return renderBloqueMarcados(grupos, {
    bloque: "decimales",
    titulo: "Se cuentan con decimales",
    nota: "En el conteo aceptan coma (ej. 2,5), hasta 2 decimales. El resto se cuenta en enteros.",
    vacio: "Todos los productos se cuentan en enteros.",
    etiquetaSelect: "Producto que se cuenta con decimales",
    accionQuitar: "quitar-decimales",
    etiquetaQuitar: (nombre) => `Contar ${nombre} solo en enteros`,
    estaMarcado: (producto) => producto.permite_decimales === true,
  });
}

export function renderAdminPanel(container, datos = {}) {
  if (!container) return;

  const {
    empleados = [],
    categorias = [],
    productos = [],
    stockPorProducto = {},
  } = datos;

  // Conserva que categorias de productos estaban abiertas entre recargas.
  const abiertos = new Set(
    Array.from(container.querySelectorAll("details.admin-grupo[open]")).map(
      (detalle) => detalle.dataset.categoria,
    ),
  );
  const mensajeAnterior = container.querySelector("#admin-mensaje");
  const grupos = agruparProductosPorCategoria(categorias, productos);

  container.innerHTML = `
    <div class="admin-panel">
      <p id="admin-mensaje" class="admin-mensaje" role="status" aria-live="polite" hidden></p>
      ${renderEmpleados(Array.isArray(empleados) ? empleados : [])}
      ${renderCategorias(grupos)}
      ${renderProductos(grupos, stockPorProducto, abiertos)}
      ${renderSinAviso(grupos)}
      ${renderDecimales(grupos)}
    </div>
  `;

  if (mensajeAnterior && !mensajeAnterior.hidden) {
    const nuevo = container.querySelector("#admin-mensaje");
    nuevo.textContent = mensajeAnterior.textContent;
    nuevo.className = mensajeAnterior.className;
    nuevo.hidden = false;
  }
}

// Abre, debajo del producto, el selector para elegir su nueva categoria.
// Solo puede haber uno abierto a la vez.
export function renderFormMover(boton, categorias = []) {
  const item = boton?.closest(".admin-item");

  if (!item) return null;

  item.closest(".admin-panel")?.querySelectorAll(".admin-form-mover").forEach((form) => form.remove());

  const { id, nombre } = boton.dataset;
  const grupoActual = boton.closest("details.admin-grupo")?.dataset.categoria || "";
  const opciones = ordenarPorNombre(Array.isArray(categorias) ? categorias : [])
    .map((categoria) => {
      const actual = String(categoria.id) === grupoActual;

      return `<option value="${escapeHtml(categoria.id)}"${actual ? " disabled" : ""}>${escapeHtml(
        categoria.nombre,
      )}${actual ? " (actual)" : ""}</option>`;
    })
    .join("");

  const form = document.createElement("form");
  form.className = "admin-form admin-form-mover";
  form.dataset.form = "mover";
  form.dataset.id = id;
  form.dataset.nombre = nombre;
  form.setAttribute("autocomplete", "off");
  form.innerHTML = `
    <select name="categoria_id" aria-label="Nueva categoría de ${escapeHtml(nombre)}" required>
      <option value="" selected disabled>Mover a…</option>
      ${opciones}
    </select>
    <button type="submit">Mover</button>
    <button type="button" class="admin-cancelar" data-accion="cancelar-mover">Cancelar</button>
  `;

  item.append(form);
  form.querySelector("select").focus();

  return form;
}

export function renderAdminMensaje(container, { tipo = "ok", texto = "" } = {}) {
  const mensaje = container?.querySelector("#admin-mensaje");

  if (!mensaje) return;

  mensaje.textContent = texto;
  mensaje.className = `admin-mensaje admin-mensaje-${tipo === "error" ? "error" : "ok"}`;
  mensaje.hidden = !texto;
}

export function setAdminOcupado(container, ocupado) {
  container?.querySelectorAll(".admin-panel button, .admin-panel input, .admin-panel select")
    .forEach((control) => {
      if (ocupado) {
        control.dataset.estabaDeshabilitado = control.disabled ? "1" : "";
        control.disabled = true;
        return;
      }

      // Solo restaura controles que deshabilito esta funcion; los que vienen
      // de un render nuevo ya traen su estado correcto.
      if (!("estabaDeshabilitado" in control.dataset)) return;

      control.disabled = control.dataset.estabaDeshabilitado === "1";
      delete control.dataset.estabaDeshabilitado;
    });
}
