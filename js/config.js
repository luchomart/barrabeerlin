export const APP_VERSION = "0.2.1";

export const SUPABASE_URL = "https://bcfnqbhrfjaqjdcwynqw.supabase.co";

export const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjZm5xYmhyZmphcWpkY3d5bnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwOTQ5OTksImV4cCI6MjA4ODY3MDk5OX0.wR7mM5FMCgOvQqqmBu4FAbSKU6luu_sQ4NTbRhaD58U";

export const EMPLEADOS = ["", "Karen", "Eve", "Nicolas", "Luciano", "Fiorella"];

export const CATEGORIA_VIRTUAL_BARRILES = {
  id: "barriles",
  nombre: "\u{1F37A} Barriles (sin pinchar)",
};

// Hash SHA-256 del password actual. Esto evita dejar la clave en texto plano,
// aunque el control real de acceso sigue siendo una mejora futura de backend.
export const SUPERVISOR_PASSWORD_HASH =
  "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";

export const ORDEN_CATEGORIAS_SECTOR = {
  camara: [
    "Gaseosas",
    "Aguas",
    "Cervezas",
    "Aguas saborizadas",
    "Energ\u00E9ticas",
    "Espumantes",
    "Vinos",
    "Destilados, licores y aperitivos",
  ],

  "deposito superior": [
    "Vinos",
    "Espumantes",
    "Destilados, licores y aperitivos",
  ],

  "deposito cocina": ["Aguas", "Cervezas", "Gaseosas", "Aguas saborizadas"],

  "estantes barra": [
    "Destilados, licores y aperitivos",
    "Aguas",
    "Aguas saborizadas",
    "Energ\u00E9ticas",
  ],

  exhibidoras: [
    "Gaseosas",
    "Aguas",
    "Aguas saborizadas",
    "Cervezas",
    "Energ\u00E9ticas",
    "Vinos",
  ],
};
