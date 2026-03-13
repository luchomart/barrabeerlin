// =============================
// RENDER SECTORES
// =============================

export function renderSectores(selectSector, sectores) {
  selectSector.innerHTML = "";

  // opción inicial
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

// =============================
// RENDER PRODUCTOS
// =============================

export function renderProductos(
  listaProductos,
  categorias,
  productos,
  onInput,
) {
  listaProductos.innerHTML = "";

  categorias.forEach((categoria) => {
    const productosCategoria = productos.filter(
      (p) => Number(p.categoria_id) === Number(categoria.id),
    );

    if (productosCategoria.length === 0) return;

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

      document.querySelectorAll(".categoria-productos").forEach((el) => {
        el.classList.add("categoria-cerrada");
      });

      document.querySelectorAll(".categoria-titulo").forEach((el) => {
        el.classList.remove("categoria-abierta");
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

      // guardar valor anterior
      let valorAnterior = input.value;

      // cuando el usuario toca el input
      input.addEventListener("focus", () => {
        valorAnterior = input.value;

        setTimeout(() => {
          input.select();
        }, 0);
      });

      // cuando escribe
      input.addEventListener("input", () => {
        onInput(input);
      });

      // controlar + y -
      input.addEventListener("keydown", (e) => {
        if (e.key === "+" || e.key === "=") {
          e.preventDefault();

          let valor = parseInt(input.value || "0");
          valor++;

          input.value = valor;

          onInput(input);

          input.select();
        }

        if (e.key === "-") {
          e.preventDefault();

          let valor = parseInt(input.value || "0");

          if (valor > 0) {
            valor--;
          }

          input.value = valor;

          onInput(input);

          input.select();
        }
      });

      // si sale del input
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

// =============================
// ACTUALIZAR INPUTS STOCK
// =============================

export function actualizarInputsStock(data) {
  const mapa = {};

  data.forEach((r) => {
    mapa[r.producto_id] = r.cantidad;
  });

  document.querySelectorAll("#lista-productos input").forEach((input) => {
    const productoId = input.dataset.id;

    input.value = mapa[productoId] ?? 0;

    input.classList.remove("input-modificado");
  });
}
