export const APP_VERSION = "0.5.0";

export const SUPABASE_URL = "https://bcfnqbhrfjaqjdcwynqw.supabase.co";

export const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjZm5xYmhyZmphcWpkY3d5bnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwOTQ5OTksImV4cCI6MjA4ODY3MDk5OX0.wR7mM5FMCgOvQqqmBu4FAbSKU6luu_sQ4NTbRhaD58U";

export const CATEGORIA_VIRTUAL_BARRILES = {
  id: "barriles",
  nombre: "Barriles (sin pinchar)",
};

// Nombre de la categoria real cuyos productos se cuentan como barriles en Camara.
export const NOMBRE_CATEGORIA_BARRILES = "Barriles";

// Respaldo: barriles reconocidos por nombre aunque no esten en esa categoria.
export const PRODUCTOS_BARRILES_CAMARA = [
  "IPA",
  "Session IPA",
  "Mexican Lager",
  "Amber",
  "Stout",
  "Honey",
  "Barley Wine",
  "Red Ipa",
];

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

  "estante cocina": ["Aguas", "Cervezas", "Gaseosas", "Aguas saborizadas"],

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
