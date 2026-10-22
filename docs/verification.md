# Verificación — 2026-10-07

## Expulsión simple y tareas en vivo — 2026-10-22

- Nuevo comando `participant.remove`: exclusivo del moderador, no permite expulsarse a sí mismo y elimina el voto solo si la ronda sigue abierta. Los votos revelados e históricos se conservan.
- El hub notifica la expulsión y cierra con código 4003 todas las conexiones del participante. La membresía se verifica antes de devolver respuestas idempotentes; el reingreso es voluntario y obtiene un participante nuevo.
- Los navegadores expulsados muestran el formulario de ingreso con aviso, sin reconectarse automáticamente. Se comprueba la membresía al perder la conexión y se ignoran respuestas de una membresía anterior después de volver a entrar.
- La publicación de tareas por WebSocket ya existía: se mantiene y se comprueba con sockets reales y con varios navegadores, incluso agregando tareas durante una votación abierta. No se recarga la página ni se cambia la tarea activa.
- Cobertura nueva: permisos, limpieza de votos abiertos, conservación de historial, reintentos tras expulsión, cierre de varias pestañas, cancelar/confirmar, reingreso, autorización 403 sin expulsión y respuesta 403 antigua tras reingresar.
- Interfaz revisada en escritorio y móvil de 390 px; botón × accesible por nombre y sin desbordamiento horizontal.
- Validación: 25 pruebas unitarias/servidor, tipos y compilación correctos. Los siete escenarios Playwright pasan (la primera ejecución requirió corregir el selector de una alerta en la prueba nueva y repetir ambos escenarios nuevos). Se mantienen los casos de diez participantes y recuperación de respuestas bloqueadas. Revisión independiente sin hallazgos pendientes.

- `pnpm test`: 20 pruebas pasaron (escalas, estadísticas, permisos, identidad, SQLite, votos secretos, concurrencia, WebSocket, salud, archivos estáticos, UUID en HTTP y orígenes LAN/VPS).
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

## Red local y VPS

- Docker reconstruido con origen automático por defecto. Los tres flujos Playwright pasaron desde `http://192.168.1.154:3000` y desde `http://localhost:3000`.
- El navegador confirmó contexto HTTP inseguro y ausencia de `crypto.randomUUID`; crear sesiones y enviar comandos funciona con UUID v4 generado mediante `getRandomValues`.
- Compartir en HTTP muestra un enlace seleccionable cuando el portapapeles no está disponible.
- Pruebas del servidor verifican que un dominio HTTPS explícito funciona detrás de una dirección interna HTTP, emite cookie Secure y rechaza otros orígenes. No se desplegó en un VPS real.
- Acceso probado desde este equipo a su IP LAN; no se comprobó otro dispositivo físico ni se cambió el firewall.
