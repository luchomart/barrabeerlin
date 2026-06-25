const MOCK_SECTORES = [
  { id: "1", nombre: "Camara" },
  { id: "2", nombre: "Estantes Barra" },
  { id: "3", nombre: "Deposito Cocina" },
];

const MOCK_CATEGORIAS = [
  { id: 1, nombre: "Cervezas" },
  { id: 2, nombre: "Gaseosas" },
  { id: 3, nombre: "Aguas" },
  { id: 4, nombre: "Destilados, licores y aperitivos" },
];

const MOCK_PRODUCTOS = [
  { id: 101, nombre: "IPA", categoria_id: 1, orden: 1 },
  { id: 102, nombre: "Session IPA", categoria_id: 1, orden: 2 },
  { id: 103, nombre: "Mexican Lager", categoria_id: 1, orden: 3 },
  { id: 104, nombre: "Amber", categoria_id: 1, orden: 4 },
  { id: 105, nombre: "Stout", categoria_id: 1, orden: 5 },
  { id: 106, nombre: "Honey", categoria_id: 1, orden: 6 },
  { id: 107, nombre: "Barley Wine", categoria_id: 1, orden: 7 },
  { id: 108, nombre: "Red Ipa", categoria_id: 1, orden: 8 },
  { id: 201, nombre: "Coca Cola", categoria_id: 2, orden: 9 },
  { id: 202, nombre: "Agua", categoria_id: 3, orden: 10 },
  { id: 301, nombre: "Gin", categoria_id: 4, orden: 11 },
  { id: 302, nombre: "Chivas Regal Mizunara", categoria_id: 4, orden: 12 },
  { id: 303, nombre: "Chivas 18", categoria_id: 4, orden: 13 },
  { id: 304, nombre: "Jony Walker Black", categoria_id: 4, orden: 14 },
  { id: 305, nombre: "Jony Walker Red", categoria_id: 4, orden: 15 },
  { id: 306, nombre: "Jameson", categoria_id: 4, orden: 16 },
];

const INVENTARIO_POR_SECTOR = {
  "1": [
    { producto_id: 101, cantidad: 4 },
    { producto_id: 108, cantidad: 2 },
    { producto_id: 201, cantidad: 6 },
  ],
  "2": [
    { producto_id: 201, cantidad: 8 },
    { producto_id: 301, cantidad: 3 },
    { producto_id: 302, cantidad: 1 },
    { producto_id: 303, cantidad: 1 },
    { producto_id: 304, cantidad: 2 },
    { producto_id: 305, cantidad: 2 },
    { producto_id: 306, cantidad: 1 },
  ],
  "3": [
    { producto_id: 202, cantidad: 5 },
  ],
};

const CONTEOS_HOY = [
  {
    empleado: "Karen",
    sector_id: "1",
    ultima_actualizacion: "2026-04-16T19:30:00.000Z",
    sectores: { nombre: "Camara" },
  },
  {
    empleado: "Luciano",
    sector_id: "2",
    ultima_actualizacion: "2026-04-16T19:10:00.000Z",
    sectores: { nombre: "Estantes Barra" },
  },
];

const INVENTARIO_CON_SECTORES = [
  { producto_id: 101, cantidad: 4, sectores: { nombre: "Camara" } },
  { producto_id: 201, cantidad: 8, sectores: { nombre: "Estantes Barra" } },
  { producto_id: 302, cantidad: 1, sectores: { nombre: "Estantes Barra" } },
  { producto_id: 303, cantidad: 1, sectores: { nombre: "Estantes Barra" } },
  { producto_id: 304, cantidad: 2, sectores: { nombre: "Estantes Barra" } },
  { producto_id: 305, cantidad: 2, sectores: { nombre: "Estantes Barra" } },
  { producto_id: 306, cantidad: 1, sectores: { nombre: "Estantes Barra" } },
  { producto_id: 202, cantidad: 5, sectores: { nombre: "Deposito Cocina" } },
];

const DIFERENCIAS_STOCK = [
  {
    producto_id: 101,
    actual: 4,
    anterior: 10,
    diferencia: -6,
    magnitud: 6,
    tipo: "salida",
    snapshot_actual_fecha: "2026-04-16T19:30:00.000Z",
    snapshot_anterior_fecha: "2026-04-16T18:30:00.000Z",
  },
  {
    producto_id: 201,
    actual: 10,
    anterior: 6,
    diferencia: 4,
    magnitud: 4,
    tipo: "entrada",
    snapshot_actual_fecha: "2026-04-16T19:30:00.000Z",
    snapshot_anterior_fecha: "2026-04-16T18:30:00.000Z",
  },
  {
    producto_id: 104,
    actual: 3,
    anterior: 3,
    diferencia: 0,
    magnitud: 0,
    tipo: "sin_cambio",
    snapshot_actual_fecha: "2026-04-16T19:30:00.000Z",
    snapshot_anterior_fecha: "2026-04-16T18:30:00.000Z",
  },
];

function buildCatalogoServiceMock(options = {}) {
  const {
    failCategorias = false,
    failProductos = false,
    failSectores = false,
  } = options;
  const body = `
    const sectores = ${JSON.stringify(MOCK_SECTORES)};
    const productos = ${JSON.stringify(MOCK_PRODUCTOS)};
    const categorias = ${JSON.stringify(MOCK_CATEGORIAS)};

    export async function getSectores() {
      if (${JSON.stringify(failSectores)}) {
        throw new Error("mock getSectores error");
      }

      return sectores;
    }

    export async function getProductos() {
      if (${JSON.stringify(failProductos)}) {
        throw new Error("mock getProductos error");
      }

      return productos;
    }

    export async function getCategorias() {
      if (${JSON.stringify(failCategorias)}) {
        throw new Error("mock getCategorias error");
      }

      return categorias;
    }
  `;

  return body;
}

function buildInventarioServiceMock(options = {}) {
  const {
    failCambios = false,
    failConteos = false,
    failGuardar = false,
    failInventarioConSectores = false,
    failInventarioSector = false,
    failSnapshot = false,
  } = options;
  const body = `
    const inventarioPorSector = ${JSON.stringify(INVENTARIO_POR_SECTOR)};
    const conteosHoy = ${JSON.stringify(CONTEOS_HOY)};
    const inventarioConSectores = ${JSON.stringify(INVENTARIO_CON_SECTORES)};
    const diferenciasStock = ${JSON.stringify(DIFERENCIAS_STOCK)};
    const inventarioTotal = [
      { producto_id: 101, cantidad: 4 },
      { producto_id: 108, cantidad: 2 },
      { producto_id: 201, cantidad: 14 },
      { producto_id: 202, cantidad: 5 },
      { producto_id: 301, cantidad: 3 },
      { producto_id: 302, cantidad: 1 },
      { producto_id: 303, cantidad: 1 },
      { producto_id: 304, cantidad: 2 },
      { producto_id: 305, cantidad: 2 },
      { producto_id: 306, cantidad: 1 },
    ];

    export async function getInventarioSector(sectorId) {
      if (${JSON.stringify(failInventarioSector)}) {
        throw new Error("mock getInventarioSector error");
      }

      return inventarioPorSector[String(sectorId)] || [];
    }

    export async function guardarInventario(registros) {
      if (${JSON.stringify(failGuardar)}) {
        throw new Error("mock guardarInventario error");
      }

      globalThis.__mockUltimoGuardado = registros;
      return [];
    }

    export async function getInventarioTotal() {
      return inventarioTotal;
    }

    export async function saveStockSnapshot(stockData) {
      if (${JSON.stringify(failSnapshot)}) {
        throw new Error("mock saveStockSnapshot error");
      }

      globalThis.__mockUltimoSnapshot = stockData;
      return {
        status: "created",
        fecha: "2026-04-16T19:35:00.000Z",
        registros: [],
        resumen: {
          fecha: "2026-04-16T19:35:00.000Z",
          totalProductos: 5,
          totalUnidades: 28,
          fingerprint: "mock",
        },
      };
    }

    export async function getConteosDesde() {
      if (${JSON.stringify(failConteos)}) {
        throw new Error("mock getConteosDesde error");
      }

      return conteosHoy;
    }

    export async function getInventarioConSectores() {
      if (${JSON.stringify(failInventarioConSectores)}) {
        throw new Error("mock getInventarioConSectores error");
      }

      return inventarioConSectores;
    }

    export async function getDiferenciasStock() {
      if (${JSON.stringify(failCambios)}) {
        throw new Error("mock getDiferenciasStock error");
      }

      return diferenciasStock;
    }
  `;

  return body;
}

function buildAuthServiceMock(options = {}) {
  const {
    authenticatedSupervisor = false,
    failAuth = false,
    supervisorEmail = "supervisor@beerlin.online",
  } = options;

  const initialUser = authenticatedSupervisor
    ? {
        id: "sup-1",
        email: supervisorEmail,
        app_metadata: { role: "supervisor" },
      }
    : null;

  const body = `
    const STORAGE_KEY = "__mock_supervisor_user";

    function leerUsuario() {
      const raw = globalThis.localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return ${JSON.stringify(initialUser)};
      }

      try {
        return JSON.parse(raw);
      } catch (_error) {
        return ${JSON.stringify(initialUser)};
      }
    }

    function guardarUsuario(user) {
      if (!user) {
        globalThis.localStorage.removeItem(STORAGE_KEY);
        return;
      }

      globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    }

    let currentUser = leerUsuario();
    const listeners = new Set();

    function notificar(evento) {
      listeners.forEach((callback) => {
        callback(evento, currentUser ? { user: currentUser } : null);
      });
    }

    export async function getSupervisorUser() {
      return currentUser;
    }

    export async function signInSupervisor({ email }) {
      if (${JSON.stringify(failAuth)}) {
        throw new Error("Invalid login credentials");
      }

      currentUser = {
        id: "sup-1",
        email,
        app_metadata: { role: "supervisor" },
      };

      guardarUsuario(currentUser);
      globalThis.__mockSupervisorUser = currentUser;
      notificar("SIGNED_IN");

      return currentUser;
    }

    export async function signOutSupervisor() {
      currentUser = null;
      guardarUsuario(null);
      globalThis.__mockSupervisorSignedOut = true;
      notificar("SIGNED_OUT");
    }

    export function onSupervisorAuthChange(callback) {
      listeners.add(callback);

      return () => {
        listeners.delete(callback);
      };
    }
  `;

  return body;
}

export async function mockAppServices(page, options = {}) {
  await page.route("**/js/services/catalogoService.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: buildCatalogoServiceMock(options),
    });
  });

  await page.route("**/js/services/inventarioService.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: buildInventarioServiceMock(options),
    });
  });

  await page.route("**/js/services/authService.js", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: buildAuthServiceMock(options),
    });
  });
}
