// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../js/services/supabaseClient.js", () => ({ supabase: {} }));

import {
  agruparProductosPorCategoria,
  renderAdminMensaje,
  renderAdminPanel,
  renderFormMover,
  setAdminOcupado,
} from "../../js/ui/adminRenderer.js";

const { construirStockPorProducto, textoConfirmacionProducto } = await import(
  "../../js/modules/supervisor/adminController.js"
);

const DATOS = {
  empleados: [
    { id: 1, nombre: "Karen" },
    { id: 2, nombre: "<b>Eve</b>" },
  ],
  categorias: [
    { id: 2, nombre: "Gaseosas" },
    { id: 14, nombre: "Energizantes" },
  ],
  productos: [
    { id: 11, nombre: "Sprite", categoria_id: 2, orden: 11 },
    { id: 10, nombre: "Coca Cola", categoria_id: 2, orden: 10 },
    { id: 50, nombre: "Huerfano", categoria_id: null, orden: null },
  ],
  stockPorProducto: { 11: { unidades: 18, sectores: 2 } },
};

describe("adminRenderer", () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<div id="admin-contenido"></div>';
    container = document.getElementById("admin-contenido");
  });

  it("agrupa por categoria, ordena por orden y separa productos sin categoria", () => {
    const grupos = agruparProductosPorCategoria(DATOS.categorias, DATOS.productos);

    expect(grupos.map((grupo) => grupo.nombre)).toEqual([
      "Energizantes",
      "Gaseosas",
      "Sin categoría",
    ]);
    expect(grupos[1].productos.map((producto) => producto.nombre)).toEqual([
      "Coca Cola",
      "Sprite",
    ]);
    expect(grupos[2].productos.map((producto) => producto.id)).toEqual([50]);
  });

  it("renderiza los tres bloques, escapa nombres y bloquea borrar categorias con productos", () => {
    renderAdminPanel(container, DATOS);

    expect(container.querySelectorAll('[data-accion="eliminar-empleado"]')).toHaveLength(2);
    expect(container.innerHTML).toContain("&lt;b&gt;Eve&lt;/b&gt;");
    expect(container.querySelector("b")).toBeNull();

    const borrarGaseosas = container.querySelector(
      '[data-accion="eliminar-categoria"][data-id="2"]',
    );
    const borrarEnergizantes = container.querySelector(
      '[data-accion="eliminar-categoria"][data-id="14"]',
    );
    expect(borrarGaseosas.disabled).toBe(true);
    expect(borrarEnergizantes.disabled).toBe(false);

    const opciones = Array.from(
      container.querySelectorAll('form[data-form="producto"] option'),
    ).map((opcion) => opcion.value);
    expect(opciones).toEqual(["", "14", "2"]);

    expect(container.querySelector('details[data-categoria="sin-categoria"]')).not.toBeNull();
    expect(container.textContent).toContain("18 u.");
  });

  it("conserva categorias abiertas y el mensaje al re-renderizar", () => {
    renderAdminPanel(container, DATOS);
    container.querySelector('details[data-categoria="2"]').open = true;
    renderAdminMensaje(container, { tipo: "error", texto: "Ya existe" });

    renderAdminPanel(container, DATOS);

    expect(container.querySelector('details[data-categoria="2"]').open).toBe(true);
    const mensaje = container.querySelector("#admin-mensaje");
    expect(mensaje.hidden).toBe(false);
    expect(mensaje.className).toContain("admin-mensaje-error");
    expect(mensaje.textContent).toBe("Ya existe");
  });

  it("al liberar el panel no habilita controles que un render nuevo trae deshabilitados", () => {
    renderAdminPanel(container, DATOS);
    setAdminOcupado(container, true);

    expect(
      Array.from(container.querySelectorAll("button")).every((boton) => boton.disabled),
    ).toBe(true);

    renderAdminPanel(container, DATOS);
    setAdminOcupado(container, false);

    expect(
      container.querySelector('[data-accion="eliminar-categoria"][data-id="2"]').disabled,
    ).toBe(true);
    expect(container.querySelector('form[data-form="empleado"] button').disabled).toBe(false);
  });
});

describe("adminController helpers", () => {
  it("suma stock por producto ignorando ceros", () => {
    expect(
      construirStockPorProducto([
        { producto_id: 11, cantidad: 6, sector_nombre: "Exhibidoras" },
        { producto_id: 11, cantidad: 12, sector_nombre: "Camara" },
        { producto_id: 10, cantidad: 0, sector_nombre: "Camara" },
      ]),
    ).toEqual({ 11: { unidades: 18, sectores: 2 } });
  });

  it("arma la confirmacion de borrado segun el stock conocido", () => {
    expect(textoConfirmacionProducto("Sprite", { unidades: 18, sectores: 2 })).toContain(
      "Tiene 18 unidad(es) en 2 sector(es).",
    );
    expect(textoConfirmacionProducto("Fanta", null)).toContain("No tiene stock cargado.");
    expect(textoConfirmacionProducto("Fanta", undefined)).toContain(
      "No se pudo consultar su stock actual.",
    );
  });

  it("abre un solo selector para mover un producto, sin ofrecer su categoria actual", () => {
    document.body.innerHTML = '<div id="admin-contenido"></div>';
    const container = document.getElementById("admin-contenido");

    renderAdminPanel(container, DATOS);

    const moverSprite = container.querySelector('[data-accion="mover-producto"][data-nombre="Sprite"]');
    const moverHuerfano = container.querySelector('[data-accion="mover-producto"][data-nombre="Huerfano"]');

    expect(moverSprite.getAttribute("aria-label")).toBe("Mover Sprite a otra categoría");

    const form = renderFormMover(moverSprite, DATOS.categorias);

    expect(form.dataset.form).toBe("mover");
    expect(form.dataset.id).toBe("11");
    expect(moverSprite.closest(".admin-item").contains(form)).toBe(true);

    const actual = form.querySelector('option[value="2"]');
    expect(actual.disabled).toBe(true);
    expect(actual.textContent).toBe("Gaseosas (actual)");
    expect(form.querySelector('option[value="14"]').disabled).toBe(false);

    // Abrir otro cierra el anterior; un producto sin categoria puede ir a cualquiera.
    const otro = renderFormMover(moverHuerfano, DATOS.categorias);

    expect(container.querySelectorAll(".admin-form-mover")).toHaveLength(1);
    expect(otro.querySelectorAll("option:not([disabled])")).toHaveLength(2);
  });
});
