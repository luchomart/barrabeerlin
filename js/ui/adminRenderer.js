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
      nombre: "Sin categoria",
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
    >&#x2715;</button>
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
      <h3>Categorias</h3>
      <ul class="admin-lista">${items || '<li class="admin-vacio">Sin categorias</li>'}</ul>
      <form class="admin-form" data-form="categoria" autocomplete="off">
        <input name="nombre" type="text" maxlength="60" placeholder="Nueva categoria" aria-label="Nombre de la categoria" required />
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
          const meta = stock ? `${stock.unidades} u.` : "";

          return `
            <li class="admin-item">
              <span class="admin-item-nombre">${escapeHtml(producto.nombre)}</span>
              <span class="admin-item-meta">${meta}</span>
              ${botonBorrar("eliminar-producto", producto.id, producto.nombre)}
            </li>
          `;
        })
        .join("");

      return `
        <details class="admin-grupo${grupo.sinCategoria ? " admin-grupo-alerta" : ""}" data-categoria="${escapeHtml(grupo.id)}" ${abiertos.has(grupo.id) ? "open" : ""}>
          <summary>${escapeHtml(grupo.nombre)} <span class="admin-count">(${grupo.productos.length})</span></summary>
          ${grupo.sinCategoria ? '<p class="admin-nota">Estos productos no aparecen en ningun sector.</p>' : ""}
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
        <select name="categoria_id" aria-label="Categoria del producto" required>
          <option value="" selected disabled>Categoria...</option>
          ${opciones}
        </select>
        <button type="submit">Agregar</button>
      </form>
      ${bloques}
    </div>
  `;
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
    </div>
  `;

  if (mensajeAnterior && !mensajeAnterior.hidden) {
    const nuevo = container.querySelector("#admin-mensaje");
    nuevo.textContent = mensajeAnterior.textContent;
    nuevo.className = mensajeAnterior.className;
    nuevo.hidden = false;
  }
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
