import {
  getCategorias,
  getEmpleados,
  getProductos,
} from "../../services/catalogoService.js";

import { getSupervisorInventarioConSectores } from "../../services/inventarioService.js";

import {
  agregarCategoria,
  agregarEmpleado,
  agregarProducto,
  eliminarCategoria,
  eliminarEmpleado,
  eliminarProducto,
} from "../../services/adminService.js";

import {
  renderAdminMensaje,
  renderAdminPanel,
  setAdminOcupado,
} from "../../ui/adminRenderer.js";

import { renderSupervisorError, renderSupervisorLoader } from "../../ui/renderer.js";

// Suma el stock de cada producto en todos los sectores.
export function construirStockPorProducto(inventario = []) {
  return (Array.isArray(inventario) ? inventario : []).reduce((acumulado, fila) => {
    const id = String(fila?.producto_id ?? "");
    const cantidad = Math.max(0, Number(fila?.cantidad) || 0);

    if (!id || !cantidad) return acumulado;

    if (!acumulado[id]) {
      acumulado[id] = { unidades: 0, sectores: 0 };
    }

    acumulado[id].unidades += cantidad;
    acumulado[id].sectores += 1;

    return acumulado;
  }, {});
}

export function textoConfirmacionProducto(nombre, stock) {
  const lineas = [`Eliminar "${nombre}"?`, ""];

  if (stock === undefined) {
    lineas.push("No se pudo consultar su stock actual.");
  } else if (stock?.unidades) {
    lineas.push(
      `Tiene ${stock.unidades} unidad(es) en ${stock.sectores} sector(es).`,
    );
  } else {
    lineas.push("No tiene stock cargado.");
  }

  lineas.push(
    "Tambien se borra su stock y su historial de snapshots. No se puede deshacer.",
  );

  return lineas.join("\n");
}

export function initAdminPanel({ section, contenido, button } = {}) {
  if (!section || !contenido || !button) {
    return { ocultar() {} };
  }

  let datos = null;
  let stockDisponible = false;
  let ocupado = false;

  async function cargar() {
    if (!datos) {
      renderSupervisorLoader(contenido, "Cargando administracion...");
    }

    try {
      const [empleados, categorias, productos] = await Promise.all([
        getEmpleados(),
        getCategorias(),
        getProductos(),
      ]);

      // El stock solo se usa para avisar al borrar: si falla, el panel sigue andando.
      let stockPorProducto = {};
      stockDisponible = false;

      try {
        stockPorProducto = construirStockPorProducto(
          await getSupervisorInventarioConSectores(),
        );
        stockDisponible = true;
      } catch (error) {
        console.error(error);
      }

      datos = { empleados, categorias, productos, stockPorProducto };
      renderAdminPanel(contenido, datos);
    } catch (error) {
      console.error(error);
      datos = null;
      renderSupervisorError(contenido, "Error cargando administracion");
    }
  }

  async function ejecutar(accion, mensajeOk) {
    if (ocupado) return;

    ocupado = true;
    setAdminOcupado(contenido, true);

    try {
      await accion();
      await cargar();
      renderAdminMensaje(contenido, { tipo: "ok", texto: mensajeOk });
      return true;
    } catch (error) {
      console.error(error);
      renderAdminMensaje(contenido, {
        tipo: "error",
        texto: error?.message || "No se pudo completar la operacion.",
      });
      return false;
    } finally {
      ocupado = false;
      setAdminOcupado(contenido, false);
    }
  }

  function ocultar() {
    section.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }

  button.setAttribute("aria-controls", section.id);
  button.setAttribute("aria-expanded", "false");

  button.addEventListener("click", async () => {
    if (!section.hidden) {
      ocultar();
      return;
    }

    section.hidden = false;
    button.setAttribute("aria-expanded", "true");
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    await cargar();
  });

  contenido.addEventListener("submit", async (event) => {
    const form = event.target.closest("form[data-form]");

    if (!form) return;

    event.preventDefault();

    const formData = new FormData(form);
    const nombre = String(formData.get("nombre") || "").trim();

    if (!nombre) return;

    if (form.dataset.form === "empleado") {
      await ejecutar(() => agregarEmpleado(nombre), `Empleado "${nombre}" agregado.`);
    } else if (form.dataset.form === "categoria") {
      await ejecutar(() => agregarCategoria(nombre), `Categoria "${nombre}" agregada.`);
    } else if (form.dataset.form === "producto") {
      const categoriaId = formData.get("categoria_id");

      if (!categoriaId) {
        renderAdminMensaje(contenido, { tipo: "error", texto: "Elegi una categoria." });
        return;
      }

      await ejecutar(
        () => agregarProducto(nombre, categoriaId),
        `Producto "${nombre}" agregado.`,
      );
    }
  });

  contenido.addEventListener("click", async (event) => {
    const boton = event.target.closest("button[data-accion]");

    if (!boton || boton.disabled) return;

    const { accion, id, nombre } = boton.dataset;

    if (accion === "eliminar-empleado") {
      const confirmar = confirm(
        `Eliminar a "${nombre}" de la lista de empleados?\n\nSus conteos anteriores no se borran.`,
      );

      if (!confirmar) return;

      await ejecutar(() => eliminarEmpleado(id), `Empleado "${nombre}" eliminado.`);
    } else if (accion === "eliminar-categoria") {
      if (!confirm(`Eliminar la categoria "${nombre}"?`)) return;

      await ejecutar(() => eliminarCategoria(id), `Categoria "${nombre}" eliminada.`);
    } else if (accion === "eliminar-producto") {
      const stock = stockDisponible
        ? datos?.stockPorProducto?.[String(id)] || null
        : undefined;

      if (!confirm(textoConfirmacionProducto(nombre, stock))) return;

      await ejecutar(() => eliminarProducto(id), `Producto "${nombre}" eliminado.`);
    }
  });

  return { ocultar };
}
