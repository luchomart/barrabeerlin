// =============================
// IMPORTAR SUPABASE
// =============================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const APP_VERSION = "0.2.0";

// =============================
// CONFIGURACIÓN SUPABASE
// =============================

export const SUPABASE_URL = "https://bcfnqbhrfjaqjdcwynqw.supabase.co";

export const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjZm5xYmhyZmphcWpkY3d5bnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwOTQ5OTksImV4cCI6MjA4ODY3MDk5OX0.wR7mM5FMCgOvQqqmBu4FAbSKU6luu_sQ4NTbRhaD58U";

// crear cliente supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// =============================
// LISTA DE EMPLEADOS
// =============================

export const EMPLEADOS = ["", "Karen", "Eve", "Nicolas", "Luciano", "Fiorella"];

// =============================
// PASSWORD SUPERVISOR
// =============================

export const PASSWORD_SUPERVISOR = "1234";

// =============================
// ORDEN DE CATEGORÍAS POR SECTOR
// =============================

export const ORDEN_CATEGORIAS_SECTOR = {
  camara: [
    "Gaseosas",
    "Aguas",
    "Cervezas",
    "Aguas saborizadas",
    "Energéticas",
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
    "Energéticas",
  ],

  exhibidoras: [
    "Gaseosas",
    "Aguas",
    "Aguas saborizadas",
    "Cervezas",
    "Energéticas",
    "Vinos",
  ],
};
