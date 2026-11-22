// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  actualizarInputsStock,
  marcarCategoriaRevisada,
  renderAvisoGuardar,
  renderComprobante,
  renderErrorCarga,
  renderEstadoConexion,
  renderAppVersionBadge,
  renderSupervisorAuthPanel,
  renderProductos,
  renderSupervisorCambios,
  renderSupervisorConteos,
  renderSupervisorError,
  renderSupervisorEstadoSectores,
  renderSupervisorLoader,
  renderSectores,
} from "../../js/ui/renderer.js";

describe("renderer", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="container">
        <div id="lista-productos"></div>
        <div id="lista-cambios-stock"></div>
        <footer></footer>
      </div>
    `;
  });

  it("renderiza productos usando categorias virtuales y handlers de input", () => {
    const onInput = vi.fn();
    const lista = document.getElementById("lista-productos");

    renderProductos(
      lista,
      [
        { id: "barriles", nombre: "Barriles (sin pinchar)" },
        { id: 2, nombre: "Gaseosas" },
      ],
      [
        { id: 1, nombre: "IPA", categoria_id: "barriles" },
        { id: 2, nombre: "Coca Cola", categoria_id: 2 },
      ],
      onInput,
    );

    const categorias = lista.querySelectorAll(".categoria-bloque");
    expect(categorias).toHaveLength(2);
    expect(lista.textContent).toContain("Barriles (sin pinchar)");
    expect(lista.textContent).toContain("IPA");

    const input = lista.querySelector('input[data-id="1"]');
    input.value = "5";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(onInput).toHaveBeenCalledWith(input);
  });

  it("maneja apertura de categoria, teclado + / - y blur vacio", async () => {
    const onInput = vi.fn();
    const lista = document.getElementById("lista-productos");

    renderProductos(
      lista,
      [{ id: 1, nombre: "Cervezas" }],
      [{ id: 1, nombre: "IPA", categoria_id: 1 }],
      onInput,
    );

    const titulo = lista.querySelector(".categoria-titulo");
    const productosDiv = lista.querySelector(".categoria-productos");
    const input = lista.querySelector('input[data-id="1"]');

    expect(productosDiv.classList.contains("categoria-cerrada")).toBe(true);

    titulo.click();

    expect(productosDiv.classList.contains("categoria-cerrada")).toBe(false);
    expect(titulo.classList.contains("categoria-abierta")).toBe(true);

    input.value = "1";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "+", bubbles: true }));
    expect(input.value).toBe("2");

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "-", bubbles: true }));
    expect(input.value).toBe("1");

    input.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    input.value = "";
    input.dispatchEvent(new FocusEvent("blur", { bubbles: true }));

    expect(input.value).toBe("1");
    expect(onInput).toHaveBeenCalledTimes(2);
  });

  it("los productos con decimales aceptan coma y suman de a uno", () => {
    const onInput = vi.fn();
    const lista = document.getElementById("lista-productos");

    renderProductos(
      lista,
      [{ id: 1, nombre: "Destilados" }],
      [
        { id: 1, nombre: "Fernet", categoria_id: 1, permite_decimales: true },
        { id: 2, nombre: "Gin", categoria_id: 1 },
      ],
      onInput,
    );

    const fernet = lista.querySelector('input[data-id="1"]');
    const gin = lista.querySelector('input[data-id="2"]');

    expect(fernet.type).toBe("text");
    expect(fernet.inputMode).toBe("decimal");
    expect(fernet.dataset.decimales).toBe("1");
    expect(gin.type).toBe("number");
    expect(gin.dataset.decimales).toBeUndefined();

    fernet.value = "1,5";
    fernet.closest(".producto-fila").querySelector('[data-paso="1"]').click();
    expect(fernet.value).toBe("2,5");

    fernet.dispatchEvent(new KeyboardEvent("keydown", { key: "-", bubbles: true }));
    expect(fernet.value).toBe("1,5");

    fernet.value = "0.5";
    fernet.closest(".producto-fila").querySelector('[data-paso="-1"]').click();
    expect(fernet.value).toBe("0");

    actualizarInputsStock([
      { producto_id: 1, cantidad: 2.25 },
      { producto_id: 2, cantidad: 4 },
    ]);
    expect(fernet.value).toBe("2,25");
    expect(gin.value).toBe("4");
  });

  it("renderiza options de sectores con placeholder inicial", () => {
    const select = document.createElement("select");

    renderSectores(select, [
      { id: "1", nombre: "Camara" },
      { id: "2", nombre: "Estantes Barra" },
    ]);

    const options = select.querySelectorAll("option");

    expect(options).toHaveLength(3);
    expect(options[0].textContent).toBe("Elegí…");
    expect(options[1].value).toBe("1");
    expect(options[2].textContent).toBe("Estantes Barra");
  });

  it("actualiza inputs de stock y limpia clases modificadas", () => {
    const lista = document.getElementById("lista-productos");

    lista.innerHTML = `
      <input data-id="1" value="0" class="input-modificado">
      <input data-id="2" value="0" class="input-modificado">
    `;

    actualizarInputsStock([
      { producto_id: 1, cantidad: 7 },
      { producto_id: 2, cantidad: 3 },
    ]);

    const inputs = lista.querySelectorAll("input");

    expect(inputs[0].value).toBe("7");
    expect(inputs[1].value).toBe("3");
    expect(inputs[0].classList.contains("input-modificado")).toBe(false);
    expect(inputs[1].classList.contains("input-modificado")).toBe(false);
  });

  it("renderiza loader y error del supervisor", () => {
    const container = document.getElementById("lista-cambios-stock");

    renderSupervisorLoader(container, "Cargando...");
    expect(container.textContent).toContain("Cargando...");

    renderSupervisorError(container, "Error cargando");
    expect(container.textContent).toContain("Error cargando");
    expect(container.textContent).toContain("Reintentá con Actualizar");
  });

  it("renderiza estados de autenticacion del supervisor", () => {
    const container = document.getElementById("lista-cambios-stock");

    renderSupervisorAuthPanel(container, {
      mode: "loading",
      message: "Verificando sesion...",
    });
    expect(container.textContent).toContain("Verificando sesion...");

    renderSupervisorAuthPanel(container, {
      mode: "login",
      email: "supervisor@beerlin.online",
      message: "Email o contrasena incorrectos.",
      loading: false,
    });
    expect(container.textContent).toContain("Ingresar al panel");
    expect(container.querySelector("#supervisor-login-email").value).toBe(
      "supervisor@beerlin.online",
    );
    expect(container.textContent).toContain("Email o contrasena incorrectos.");

    renderSupervisorAuthPanel(container, {
      mode: "session",
      userEmail: "supervisor@beerlin.online",
    });
    expect(container.textContent).toContain("Sesión de supervisor");
    expect(container.textContent).toContain("supervisor@beerlin.online");

    renderSupervisorAuthPanel(container, {
      mode: "error",
      message: "No se pudo verificar la sesion.",
    });
    expect(container.textContent).toContain("No se pudo verificar la sesion.");
    expect(container.querySelector("#btn-reintentar-auth")).toBeTruthy();
  });

  it("escapa contenido sensible en el panel de autenticacion", () => {
    const container = document.getElementById("lista-cambios-stock");

    renderSupervisorAuthPanel(container, {
      mode: "login",
      email: `sup"&'<@beerlin.online`,
      message: `<script>alert("x")</script>`,
      loading: false,
    });

    const emailInput = container.querySelector("#supervisor-login-email");
    expect(emailInput.value).toBe(`sup"&'<@beerlin.online`);
    expect(container.innerHTML).not.toContain("<script>alert");
  });

  it("renderiza conteos vacios y cards de conteos", () => {
    const container = document.getElementById("lista-cambios-stock");

    renderSupervisorConteos(container, []);
    expect(container.textContent).toContain("Sin conteos hoy");

    renderSupervisorConteos(container, [
      {
        empleado: "Karen",
        ultima_actualizacion: "2026-04-16T19:30:00.000Z",
        sectores: { nombre: "Camara" },
      },
    ]);

    expect(container.textContent).toContain("Karen");
    expect(container.textContent).toContain("Camara");
  });

  it("escapa nombres de empleados, sectores, categorias y productos", () => {
    const ataque = '<img src=x onerror="window.__xss=1">';
    const container = document.getElementById("lista-cambios-stock");
    const lista = document.getElementById("lista-productos");

    renderSupervisorConteos(container, [
      {
        empleado: ataque,
        ultima_actualizacion: "2026-04-16T19:30:00.000Z",
        sectores: { nombre: ataque },
      },
    ]);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("h3").textContent).toBe(ataque);

    renderSupervisorEstadoSectores(container, [{ id: "1", nombre: ataque }], new Set());
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain(ataque);

    renderProductos(
      lista,
      [{ id: 2, nombre: ataque }],
      [{ id: 1, nombre: "Gin <Bombay>", categoria_id: 2 }],
      vi.fn(),
    );
    expect(lista.querySelector("img")).toBeNull();
    expect(lista.querySelector(".producto-nombre").textContent).toBe("Gin <Bombay>");
    expect(lista.querySelector(".categoria-titulo").textContent).toContain(ataque);
  });

  it("renderiza estado de sectores con contados y pendientes", () => {
    const container = document.getElementById("lista-cambios-stock");

    renderSupervisorEstadoSectores(
      container,
      [
        { id: "1", nombre: "Camara" },
        { id: "2", nombre: "Estantes Barra" },
      ],
      new Set(["1"]),
    );

    expect(container.textContent).toContain("Contados");
    expect(container.textContent).toContain("Pendientes");
    expect(container.textContent).toContain("Camara");
    expect(container.textContent).toContain("Estantes Barra");
    expect(container.textContent).toContain("Contado");
    expect(container.textContent).toContain("Pendiente");
  });

  it("renderiza resumen y grupos de cambios del supervisor", () => {
    const container = document.getElementById("lista-cambios-stock");

    renderSupervisorCambios(container, {
      tieneComparacion: true,
      hayCambios: true,
      totalEntradas: 12,
      totalSalidas: -5,
      entradas: [
        {
          nombre: "Honey",
          diferencia: 12,
          tipo: "entrada",
          icono: "up",
        },
      ],
      salidas: [
        {
          nombre: "IPA",
          diferencia: -5,
          tipo: "salida",
          icono: "down",
        },
      ],
      sinCambios: [
        {
          nombre: "Amber",
          diferencia: 0,
          tipo: "sin_cambio",
          icono: "neutral",
        },
      ],
    });

    expect(container.textContent).toContain("Salida total");
    expect(container.textContent).toContain("-5");
    expect(container.textContent).toContain("Entrada total");
    expect(container.textContent).toContain("+12");
    expect(container.textContent).toContain("SALIDAS");
    expect(container.textContent).toContain("IPA: -5");
    expect(container.textContent).toContain("ENTRADAS");
    expect(container.textContent).toContain("Honey: +12");
    expect(container.textContent).toContain("SIN CAMBIOS");
    expect(container.textContent).toContain("Amber");
  });

  it("renderiza estados especiales de cambios del supervisor", () => {
    const container = document.getElementById("lista-cambios-stock");

    renderSupervisorCambios(container, null);
    expect(container.textContent).toContain("Sin datos de cambios");

    renderSupervisorCambios(container, {
      tieneComparacion: false,
      hayCambios: false,
      entradas: [],
      salidas: [],
      sinCambios: [],
    });
    expect(container.textContent).toContain("Todavía no hay con qué comparar");

    renderSupervisorCambios(container, {
      tieneComparacion: true,
      hayCambios: false,
      totalEntradas: 0,
      totalSalidas: 0,
      entradas: [],
      salidas: [],
      sinCambios: [],
    });
    expect(container.textContent).toContain("Sin cambios desde la última captura");
  });

  it("renderiza badge de version una sola vez y lo actualiza", () => {
    renderAppVersionBadge("0.2.6");
    renderAppVersionBadge("v0.2.7");

    const badges = document.querySelectorAll("[data-app-version]");

    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe("v0.2.7");
    expect(document.querySelector("footer").contains(badges[0])).toBe(true);
  });

  it("abre varias categorias a la vez, las marca revisadas y avisa la apertura", () => {
    const onCategoriaAbierta = vi.fn();
    const lista = document.getElementById("lista-productos");

    renderProductos(
      lista,
      [
        { id: 1, nombre: "Cervezas" },
        { id: 2, nombre: "Aguas" },
      ],
      [
        { id: 1, nombre: "IPA", categoria_id: 1 },
        { id: 2, nombre: "Agua", categoria_id: 2 },
      ],
      vi.fn(),
      onCategoriaAbierta,
    );

    const [cervezas, aguas] = lista.querySelectorAll(".categoria-bloque");
    const tituloCervezas = cervezas.querySelector(".categoria-titulo");

    expect(tituloCervezas.tagName).toBe("BUTTON");
    expect(tituloCervezas.getAttribute("aria-expanded")).toBe("false");
    expect(cervezas.querySelector(".categoria-estado").hidden).toBe(true);

    tituloCervezas.click();
    aguas.querySelector(".categoria-titulo").click();

    expect(tituloCervezas.getAttribute("aria-expanded")).toBe("true");
    expect(cervezas.querySelector(".categoria-productos").classList.contains("categoria-cerrada")).toBe(false);
    expect(aguas.querySelector(".categoria-productos").classList.contains("categoria-cerrada")).toBe(false);
    expect(cervezas.classList.contains("categoria-revisada")).toBe(true);
    expect(cervezas.querySelector(".categoria-estado").hidden).toBe(false);
    expect(onCategoriaAbierta).toHaveBeenCalledTimes(2);

    // Cerrarla no vuelve a avisar ni le saca la marca.
    tituloCervezas.click();
    expect(tituloCervezas.getAttribute("aria-expanded")).toBe("false");
    expect(cervezas.classList.contains("categoria-revisada")).toBe(true);
    expect(onCategoriaAbierta).toHaveBeenCalledTimes(2);
  });

  it("los botones - y + suman y restan sin bajar de 0 ni pasar de 1000", () => {
    const onInput = vi.fn();
    const lista = document.getElementById("lista-productos");

    renderProductos(
      lista,
      [{ id: 1, nombre: "Cervezas" }],
      [{ id: 1, nombre: "IPA", categoria_id: 1 }],
      onInput,
    );

    const input = lista.querySelector('input[data-id="1"]');
    const menos = lista.querySelector('[data-paso="-1"]');
    const mas = lista.querySelector('[data-paso="1"]');

    expect(input.getAttribute("aria-label")).toBe("Cantidad de IPA");
    expect(mas.getAttribute("aria-label")).toBe("Sumar uno a IPA");

    menos.click();
    expect(input.value).toBe("0");
    expect(onInput).not.toHaveBeenCalled();

    mas.click();
    mas.click();
    expect(input.value).toBe("2");
    expect(onInput).toHaveBeenCalledTimes(2);

    input.value = "1000";
    mas.click();
    expect(input.value).toBe("1000");
    expect(onInput).toHaveBeenCalledTimes(2);
  });

  it("marcarCategoriaRevisada tolera bloques nulos o ya marcados", () => {
    expect(() => marcarCategoriaRevisada(null)).not.toThrow();

    const bloque = document.createElement("div");
    bloque.innerHTML = '<span class="categoria-estado" hidden></span>';

    marcarCategoriaRevisada(bloque);
    marcarCategoriaRevisada(bloque);

    expect(bloque.classList.contains("categoria-revisada")).toBe(true);
    expect(bloque.querySelector(".categoria-estado").hidden).toBe(false);
  });

  it("renderiza el comprobante de guardado y el de pendiente sin conexion", () => {
    const el = document.createElement("section");

    renderComprobante(el, {
      tipo: "ok",
      sector: "Estantes Barra",
      hora: "21:43",
      empleado: "Karen",
      productos: 16,
    });

    expect(el.hidden).toBe(false);
    expect(el.className).toContain("comprobante-ok");
    expect(el.textContent).toContain("Estantes Barra guardado");
    expect(el.textContent).toContain("21:43 · Karen · 16 productos");
    expect(el.querySelector('[data-accion="whatsapp"]')).not.toBeNull();

    renderComprobante(el, { tipo: "pendiente", sector: "<b>Camara</b>", productos: 1 });

    expect(el.className).toContain("comprobante-pendiente");
    expect(el.textContent).toContain("<b>Camara</b> quedó guardado en este celular");
    expect(el.textContent).toContain("1 producto");
    expect(el.querySelector("b")).toBeNull();

    renderComprobante(el, null);
    expect(el.hidden).toBe(true);
    expect(el.innerHTML).toBe("");
  });

  it("renderiza el aviso junto a Guardar con acciones y lo oculta sin texto", () => {
    const el = document.createElement("div");

    renderAvisoGuardar(el, {
      tipo: "atencion",
      texto: "No abriste <Aguas>",
      acciones: [
        { accion: "revisar", texto: "Revisar" },
        { accion: "guardar-igual", texto: "Guardar igual", principal: true },
      ],
    });

    expect(el.hidden).toBe(false);
    expect(el.className).toContain("aviso-guardar-atencion");
    expect(el.textContent).toContain("No abriste <Aguas>");
    expect(el.querySelectorAll("button[data-accion]")).toHaveLength(2);
    expect(el.querySelector(".aviso-guardar-principal").dataset.accion).toBe("guardar-igual");

    renderAvisoGuardar(el);
    expect(el.hidden).toBe(true);
    expect(el.innerHTML).toBe("");
  });

  it("renderiza estado de conexion y error de carga con reintento", () => {
    const estado = document.createElement("span");

    renderEstadoConexion(estado, "pendiente", "2 sin enviar");
    expect(estado.dataset.estado).toBe("pendiente");
    expect(estado.textContent).toBe("2 sin enviar");

    const lista = document.getElementById("lista-productos");
    renderErrorCarga(lista, "No se pudo cargar la app");

    expect(lista.querySelector('[role="alert"]').textContent).toContain("No se pudo cargar la app");
    expect(lista.querySelector("#btn-reintentar-carga")).not.toBeNull();
  });
});
