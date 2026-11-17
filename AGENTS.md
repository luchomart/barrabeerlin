# Instrucciones para agentes

Antes de proponer o modificar código, lee `docs/AI_CONTEXT.md`, `README.md` y la documentación relacionada con el área afectada. Después inspecciona los archivos actuales: esta guía aporta contexto, pero el código es la fuente de verdad sobre el comportamiento implementado.

## Reglas de trabajo

- Conserva la arquitectura HTML, CSS y JavaScript vanilla; no introduzcas frameworks ni reescribas módulos completos sin una necesidad concreta.
- Mantén la experiencia mobile-first y el flujo operativo de conteo por empleado y sector.
- Usa `js/core/appState.js` como estado compartido; deja acceso a datos en `js/services/`, lógica de funciones en `js/modules/`, render en `js/ui/` y estilos en `style.css`.
- Protege el buscador y los flujos existentes. No cambies IDs del DOM, nombres de tablas, RPCs o columnas sin revisar sus consumidores.
- No inventes el estado actual de Supabase basándote solo en documentación local. Distingue entre SQL versionado y SQL realmente aplicado.
- No ejecutes SQL ni cambies datos, políticas, Auth, secretos o configuración de Supabase salvo que el usuario pida explícitamente esa acción.
- Nunca copies secretos, tokens, contraseñas ni claves privadas al repositorio. No uses una clave de servicio en el frontend.
- Si una tarea toca permisos o RPCs `SECURITY DEFINER`, explica quién podrá ejecutarlos y qué datos pueden modificar.
- Mantén los cambios pequeños y reversibles. Indica archivos afectados y efectos sobre el flujo.
- Trabaja en `dev`; `main` es la rama estable y de producción. No publiques ni fusiones a `main` sin una instrucción explícita.
- No afirmes que una validación se ejecutó si no la corriste. Sigue `docs/QA_CHECKLIST.md` cuando el usuario pida verificar cambios.

## Documentación de referencia

- `docs/AI_CONTEXT.md`: resumen del producto, arquitectura, base de datos conocida y límites de la documentación.
- `README.md`: instalación, comandos y overview.
- `docs/DATABASE.md`: tablas y campos documentados.
- `docs/SUPERVISOR_AUTH.md`: autenticación y consideraciones de seguridad.
- `docs/sql/`: SQL versionado; verifica su estado de aplicación en Supabase antes de reutilizarlo.
- `docs/ROADMAP.md`: decisiones, prioridades y trabajo futuro.
- `docs/QA_CHECKLIST.md`: validación manual.
