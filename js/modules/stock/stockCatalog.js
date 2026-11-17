import { normalizarTexto } from "../../utils/format.js";

function ordenarCategoriasPorSector(
  categorias = [],
  sectorNombre = "",
  ordenCategoriasSector = {},
) {
  const orden = ordenCategoriasSector[normalizarTexto(sectorNombre)];

  if (!Array.isArray(orden) || !orden.length) {
    return [...categorias];
  }

  return [...categorias].sort((categoriaA, categoriaB) => {
    const posA = orden.findIndex(
      (nombre) => normalizarTexto(nombre) === normalizarTexto(categoriaA?.nombre),
    );
    const posB = orden.findIndex(
      (nombre) => normalizarTexto(nombre) === normalizarTexto(categoriaB?.nombre),
    );

    if (posA === -1) return 1;
    if (posB === -1) return -1;

    return posA - posB;
  });
}

export function obtenerIdsCategoriasBarriles(
  categorias = [],
  nombreCategoriaBarriles = "",
) {
  const nombreNormalizado = normalizarTexto(nombreCategoriaBarriles);

  if (!nombreNormalizado) {
    return [];
  }

  return (Array.isArray(categorias) ? categorias : [])
    .filter((categoria) => normalizarTexto(categoria?.nombre) === nombreNormalizado)
    .map((categoria) => String(categoria.id));
}

// Un producto es barril si esta en la categoria de barriles o, como respaldo,
// si su nombre esta en la lista fija de config.js.
export function esProductoBarril(
  producto,
  nombresBarrilesNormalizados = [],
  idsCategoriasBarriles = [],
) {
  if (
    producto?.categoria_id !== null &&
    producto?.categoria_id !== undefined &&
    idsCategoriasBarriles.includes(String(producto.categoria_id))
  ) {
    return true;
  }

  return nombresBarrilesNormalizados.includes(normalizarTexto(producto?.nombre));
}

export function obtenerProductosBarriles(
  productos = [],
  nombresBarrilesNormalizados = [],
  idsCategoriasBarriles = [],
) {
  return (Array.isArray(productos) ? productos : []).filter((producto) =>
    esProductoBarril(producto, nombresBarrilesNormalizados, idsCategoriasBarriles),
  );
}

export function buildCatalogoRenderizable({
  sectorNombre = "",
  categorias = [],
  productos = [],
  ordenCategoriasSector = {},
  categoriaVirtualBarriles = null,
  nombresBarrilesNormalizados = [],
  idsCategoriasBarriles = [],
} = {}) {
  const sectorNormalizado = normalizarTexto(sectorNombre);
  const esCamara = sectorNormalizado === "camara";
  const categoriasOrdenadas = ordenarCategoriasPorSector(
    categorias,
    sectorNombre,
    ordenCategoriasSector,
  );
  const barriles = obtenerProductosBarriles(
    productos,
    nombresBarrilesNormalizados,
    idsCategoriasBarriles,
  );

  if (esCamara) {
    const idsBarriles = new Set(
      barriles.map((producto) => String(producto.id)),
    );
    const productosNoBarriles = (Array.isArray(productos) ? productos : []).filter(
      (producto) => !idsBarriles.has(String(producto.id)),
    );
    const barrilesAgrupados = barriles.map((producto) => ({
      ...producto,
      categoria_id: categoriaVirtualBarriles?.id,
    }));

    return {
      esCamara,
      barriles,
      sinBarrilesConfigurados: barriles.length === 0,
      categorias: categoriaVirtualBarriles
        ? [categoriaVirtualBarriles, ...categoriasOrdenadas]
        : categoriasOrdenadas,
      productos: [...productosNoBarriles, ...barrilesAgrupados],
    };
  }

  return {
    esCamara,
    barriles,
    sinBarrilesConfigurados: false,
    categorias: categoriasOrdenadas,
    productos: (Array.isArray(productos) ? productos : []).filter(
      (producto) =>
        !esProductoBarril(
          producto,
          nombresBarrilesNormalizados,
          idsCategoriasBarriles,
        ),
    ),
  };
}
