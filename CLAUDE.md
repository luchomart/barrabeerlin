# Stock Barra (Beerlin)

App interna de Beerlin (bar) para contar bebidas por sector desde el celular, guardar en Supabase,
compartir el total por WhatsApp y consultar desde el supervisor. Producción: https://beerlin.online

**Antes de trabajar, leé `AGENTS.md` y `docs/AI_CONTEXT.md`** (reglas, arquitectura, límites de Supabase).
El plan y "Dónde quedamos" están en `docs/ROADMAP.md`.

## Stack y comandos
- HTML + CSS + JS vanilla, Supabase (`supabase-js`), GitHub Pages. Tests: Vitest + jsdom + Playwright.
- `npm ci` · `npm test` (unitarios) · smoke en Linux: `PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run test:smoke`.
- Probar SQL nuevo antes de pasarlo: PGlite (`npm i @electric-sql/pglite` en una carpeta temporal) imitando
  roles `anon`/`authenticated` y el esquema real. En esta PC no hay Postgres ni Docker.

## Reglas extra (además de AGENTS.md)
- Trabajar en `dev` (push permitido). Nunca push/merge a `main` sin pedido explícito: GitHub Pages publica `main` en beerlin.online.
- Supabase de producción: no ejecutar SQL ni cambiar datos/políticas/Auth sin pedido explícito.
  **Todo cambio en Supabase se le pasa a Luciano como SQL listo para pegar en el SQL Editor**
  (completo, con verificación y rollback), y se versiona en `docs/sql/`.
- Estado real de Supabase: ver la sección "Estado real" de `docs/DATABASE.md` (revisado 2026-11-16).
- El repo es **público**: nada de secretos ni datos personales. Solo la clave `anon` va en el frontend.
- Proyecto independiente de `distribuidora/`: no mezclar código ni arquitectura.
- Al cerrar una tarea: actualizar `docs/ROADMAP.md` y proponer el commit.
- Smoke: un `alert` bloquea `page.click`/`page.goto`; usar el helper `aceptarDialogos(page)` de smoke.spec.js.
  Para simular sin red: `globalThis.__mockSinRed = true` (mockApp.js).
- Playwright MCP solo guarda capturas en `.playwright-mcp/` (ignorada): sacarlas al terminar.
- WhatsApp: abrir con `https://api.whatsapp.com/send?text=`. `wa.me` redirige y cambia los emojis por "�".
- Smoke: para guardar usar el helper `guardarConteo(page)` (confirma "Guardar igual" si aparece el aviso).
- Mock: `globalThis.__mockCatalogo` reemplaza el catalogo entero: pasar `productos`, `categorias` y `empleados`.
- Ver la app en el celu: Luciano corre `python3 -m http.server 8080 --bind 0.0.0.0` (a Claude se lo
  bloquea el permiso) y abre `http://192.168.1.8:8080`. Usa Supabase real: no guardar conteos de prueba.
- Catalogo real (solo lectura): `curl` a `<SUPABASE_URL>/rest/v1/productos?select=...` con la clave anon de `js/config.js`.
- Ver el tipo de una columna sin service_role: filtrar con un valor invalido (`?cantidad=eq.1.5`);
  el error dice el tipo. El endpoint OpenAPI esta bloqueado para anon.
- PGlite: no trae `pgcrypto` (sacar `create extension`, `gen_random_uuid` ya existe) y hay que dar
  `usage` en secuencias a anon/authenticated como hace Supabase.
- Cantidades: usar `redondearCantidad`/`formatearCantidad` de `js/utils/format.js`, no `Math.round`.
- Smoke en viewport de celu: el pie con Guardar se oculta con un input enfocado; hacer `blur()` antes de guardar.
