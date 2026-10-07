# Verificación — 2026-10-07

- `pnpm test`: 17 pruebas pasaron (escalas, estadísticas, permisos, identidad, SQLite, votos secretos, concurrencia, WebSocket, salud y archivos estáticos).
- `pnpm typecheck`: sin errores.
- `pnpm build`: frontend y servidor compilados correctamente. Rollup informa dos advertencias sobre comentarios de anotación de Zod; no afectan la compilación.
- Playwright sobre Edge: 3 flujos pasaron en escritorio/móvil y servidor compilado. Incluyen dos participantes, repetir/guardar/recargar, camisetas, facilitador, transferencia, contenido largo y respuestas perdidas después de guardar.
- `node scripts/verify-production.mjs`: identidad, ronda abierta, voto y estimación final sobreviven a dos reinicios reales del servidor compilado.
- Impeccable detect: sin hallazgos. Capturas de inicio/escritorio/sesión/móvil revisadas; móvil de 390px sin desbordamiento horizontal.
- Revisión independiente final: un defecto importante de reintentos identificado, reproducido y corregido con prueba de regresión; ningún otro hallazgo accionable.
- `docker compose config --quiet`: configuración válida.
- Docker verificado tras iniciar su servicio: imagen construida y contenedor arrancado con `docker compose up --build -d`, estado `healthy`, proceso como usuario `node` (UID 1000).
- Los 3 flujos Playwright pasaron también contra el contenedor en puerto 3000, incluido WebSocket, escritorio/móvil y reintentos sin duplicados.
- Persistencia del volumen verificada: identidad, ronda abierta y voto sobreviven a `docker compose restart`; la estimación final guardada sobrevive a `docker compose up -d --force-recreate` conservando el volumen.

El proyecto se versiona con Git en la rama `main`. La aplicación Docker queda disponible en http://localhost:3000. La vista previa anterior usaba el servidor compilado en puerto 3200.
