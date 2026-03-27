export const appState = {
  empleado: "",
  sector: "",
  sectorAnterior: "",
  cambiosPendientes: false,
  productos: [],
  categorias: [],
  sectores: [],

  setCatalogo({ productos = [], categorias = [], sectores = [] } = {}) {
    this.productos = Array.isArray(productos) ? [...productos] : [];
    this.categorias = Array.isArray(categorias) ? [...categorias] : [];
    this.sectores = Array.isArray(sectores) ? [...sectores] : [];
  },

  setEmpleado(empleado = "") {
    this.empleado = empleado;
  },

  setSector(sectorId = "") {
    this.sectorAnterior = this.sector;
    this.sector = sectorId;
  },

  rollbackSector() {
    this.sector = this.sectorAnterior;
  },

  resetSector() {
    this.sector = "";
    this.sectorAnterior = "";
    this.cambiosPendientes = false;
  },

  setCambiosPendientes(cambiosPendientes) {
    this.cambiosPendientes = Boolean(cambiosPendientes);
  },
};
