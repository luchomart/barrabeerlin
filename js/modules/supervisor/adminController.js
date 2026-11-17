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
  cambiarAvisoSinStock,
  eliminarCategoria,
  eliminarEmpleado,
  eliminarProducto,
  moverProducto,
} from "../../services/adminService.js";

import {
  renderAdminMensaje,
  renderAdminPanel,
  renderFormMover,
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
  const lineas = [`¿Eliminar "${nombre}"?`, ""];

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
    "También se borra su stock y su historial de capturas. No se puede deshacer.\n" +
      "(Si ya tiene ventas registradas, no se puede borrar.)",
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
  // Numero y promesa de la ultima carga pedida: las respuestas de cargas anteriores
  // se descartan y quien las esperaba recibe el resultado de la mas nueva.
  let ultimaCarga = 0;
  let cargaActual = Promise.resolve(true);

  // Devuelve false si la carga mas reciente fallo.
  function cargar() {
    const promesa = cargarDatos(++ultimaCarga);
    cargaActual = promesa;
    return promesa;
  }

  async function cargarDatos(numeroCarga) {

    if (!datos) {
      renderSupervisorLoader(contenido, "Cargando administración…");
    }

    // El stock solo se usa para avisar al borrar: si falla, el panel sigue andando.
    const stockPromesa = getSupervisorInventarioConSectores().then(
      (inventario) => construirStockPorProducto(inventario),
      (error) => {
        console.error(error);
        return null;
      },
    );

    try {
      const [empleados, categorias, productos, stockPorProducto] = await Promise.all([
        getEmpleados(),
        getCategorias(),
        getProductos(),
        stockPromesa,
      ]);

      if (numeroCarga !== ultimaCarga) return cargaActual;

      stockDisponible = stockPorProducto !== null;
      datos = {
        empleados,
        categorias,
        productos,
        stockPorProducto: stockPorProducto || {},
      };
      renderAdminPanel(contenido, datos);
      return true;
    } catch (error) {
      console.error(error);

      if (numeroCarga !== ultimaCarga) return cargaActual;

      datos = null;
      stockDisponible = false;
      renderSupervisorError(contenido, "Error cargando administración");
      return false;
    }
  }

  async function ejecutar(accion, mensajeOk) {
    if (ocupado) return;

    ocupado = true;
    setAdminOcupado(contenido, true);

    try {
      await accion();

      // cargar() no lanza errores: devuelve false si fallo la recarga.
      const recargado = await cargar();

      if (recargado) {
        renderAdminMensaje(contenido, { tipo: "ok", texto: mensajeOk });
      } else {
        // El cambio se guardo: solo fallo la recarga de la lista.
        renderSupervisorError(
          contenido,
          `${mensajeOk} Pero no se pudo actualizar la lista`,
        );
      }

      return true;
    } catch (error) {
      console.error(error);
      renderAdminMensaje(contenido, {
        tipo: "error",
        texto: error?.message || "No se pudo completar la operación.",
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

    if (form.dataset.form === "sin-aviso") {
      const productoId = formData.get("producto_id");
      const producto = (datos?.productos || []).find(
        (item) => String(item.id) === String(productoId),
      );

      if (!productoId) {
        renderAdminMensaje(contenido, { tipo: "error", texto: "Elegí un producto." });
        return;
      }

      await ejecutar(
        () => cambiarAvisoSinStock(productoId, false),
        `"${producto?.nombre || "Producto"}" ya no se avisa cuando está en 0.`,
      );
      return;
    }

    if (!nombre && form.dataset.form !== "mover") return;

    if (form.dataset.form === "empleado") {
      await ejecutar(() => agregarEmpleado(nombre), `Empleado "${nombre}" agregado.`);
    } else if (form.dataset.form === "categoria") {
      await ejecutar(() => agregarCategoria(nombre), `Categoría "${nombre}" agregada.`);
    } else if (form.dataset.form === "mover") {
      const categoriaId = formData.get("categoria_id");
      const categoria = (datos?.categorias || []).find(
        (item) => String(item.id) === String(categoriaId),
      );

      if (!categoriaId) {
        renderAdminMensaje(contenido, { tipo: "error", texto: "Elegí una categoría." });
        return;
      }

      await ejecutar(
        () => moverProducto(form.dataset.id, categoriaId),
        `Producto "${form.dataset.nombre}" movido a ${categoria?.nombre || "la categoría elegida"}.`,
      );
    } else if (form.dataset.form === "producto") {
      const categoriaId = formData.get("categoria_id");

      if (!categoriaId) {
        renderAdminMensaje(contenido, { tipo: "error", texto: "Elegí una categoría." });
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

    if (accion === "mover-producto") {
      renderFormMover(boton, datos?.categorias || []);
      return;
    }

    if (accion === "cancelar-mover") {
      const item = boton.closest(".admin-item");
      boton.closest(".admin-form-mover")?.remove();
      item?.querySelector('[data-accion="mover-producto"]')?.focus();
      return;
    }

    if (accion === "volver-a-avisar") {
      await ejecutar(
        () => cambiarAvisoSinStock(id, true),
        `"${nombre}" vuelve a avisarse cuando está en 0.`,
      );
      return;
    }

    if (accion === "eliminar-empleado") {
      const confirmar = confirm(
        `¿Eliminar a "${nombre}" de la lista de empleados?\n\nSus conteos anteriores no se borran.`,
      );

      if (!confirmar) return;

      await ejecutar(() => eliminarEmpleado(id), `Empleado "${nombre}" eliminado.`);
    } else if (accion === "eliminar-categoria") {
      if (!confirm(`¿Eliminar la categoría "${nombre}"?`)) return;

      await ejecutar(() => eliminarCategoria(id), `Categoría "${nombre}" eliminada.`);
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
