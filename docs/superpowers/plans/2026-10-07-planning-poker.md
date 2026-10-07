# Planning Poker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Entregar planning poker multisesión con votos secretos, tareas y resultados persistentes, ejecutable en Docker.

**Architecture:** React consume una API Hono del mismo origen y recibe instantáneas por WebSocket. El servidor controla permisos y transacciones SQLite; los contratos compartidos definen validación y eventos.

**Tech Stack:** TypeScript, pnpm workspaces, React, Vite, Node.js, Hono, Zod, SQLite mediante better-sqlite3, Vitest y Playwright.

**Spec:** `docs/superpowers/specs/2026-10-07-planning-poker-design.md`

## Global Constraints

- Múltiples sesiones independientes sin cuentas de usuario, con un moderador por sesión.
- Interfaz inicial en español y adaptable a escritorio y móvil.
- Un único contenedor Docker con SQLite persistente en un volumen.
- Los votos ajenos no se envían antes del revelado.
- El moderador selecciona siempre la estimación final, sin redondeo ni guardado automáticos.
- El VPS será proporcionado por un colega del usuario; su administración queda fuera del alcance.
- Una réplica; no se requiere Redis ni un servicio externo.

## Review Focus

1. Dos participantes con el mismo nombre conservan identidades y permisos distintos: tarea 2.
2. Revelar mientras llega un voto produce un resultado transaccional y ninguna modificación posterior: tarea 3.
3. Dos pestañas de una identidad no duplican votos ni presencia; cerrar una no desconecta la otra: tarea 4.
4. Una respuesta perdida no duplica una tarea o sesión al reintentar: tarea 2 y tarea 3.
5. Textos extensos y caracteres especiales no rompen la vista móvil ni se interpretan como HTML: tarea 5.

## Convenciones e interfaces

IDs opacos `string`, fechas UTC ISO, valores numéricos finitos no negativos. Límites: nombre de persona 1–60 caracteres, sesión 1–100, título 1–200, descripción hasta 5000, escala 2–30 cartas, etiqueta 1–20, hasta 500 tareas por sesión. Código aleatorio de 8 caracteres sin símbolos ambiguos. Límites iniciales por IP: 10 creaciones y 60 intentos de ingreso por minuto; respuestas 429, sin registrar credenciales.

`Scale = { name: string; cards: { label: string; value?: number }[] }`; cartas especiales se agregan aparte. `VoteChoice = string` validado contra la escala de ronda o `?` / `☕`. `RoundStatus = 'open' | 'revealed' | 'finalized' | 'discarded'`. `Actor = { credentialId: string }` resuelto exclusivamente desde cookie. `SessionSnapshot` contiene revisión, sesión, participantes y presencia, tareas, ronda activa, resultados históricos autorizados y voto propio; votos ajenos solo para rondas reveladas/finalizadas.

Comandos HTTP: `POST /api/sessions`, `POST /api/sessions/:code/join`, `GET /api/sessions/:code`, `POST /api/sessions/:code/commands`. Creación recibe `{name, participantName, scale, requestId}`; ingreso `{participantName}`. Comandos discriminados: `task.add`, `task.edit`, `task.reorder`, `task.delete`, `task.select`, `round.open`, `vote.set`, `round.reveal`, `round.repeat`, `round.save`, `round.discard`, `task.next`, `scale.set`, `moderator.transfer`, `moderator.mode`, `session.close`. Cada comando lleva `expectedRevision` y `requestId`; los duplicados exitosos devuelven su resultado previo antes de comprobar revisión. Errores `{error: {code, message}}`, con HTTP 400/401/403/404/409/429 según causa. `GET /api/sessions/:code/ws` autentica y envía `{type:'snapshot', data:SessionSnapshot}`.

## Task 1: Contratos, reglas y monorepo

**Files:** Crear `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `packages/shared/package.json`, `packages/shared/src/{index,contracts,scales,statistics}.ts`, `packages/shared/tests/{contracts,statistics}.test.ts`.

**Interfaces:** Produce `Scale`, `Actor`, `VoteChoice`, `SessionSnapshot`, `Command`, `commandSchema`, `createSessionSchema`, `joinSessionSchema`, `FIBONACCI`, `TSHIRT`, `calculateStatistics(scale: Scale, votes: VoteChoice[]): Statistics`. `Statistics` incluye distribución, cantidad ordinaria/especial, consenso y promedio/mediana opcionales.

- [x] Configurar workspace y runner Vitest; escribir pruebas de contratos y estadísticas antes de sus implementaciones.
- [x] Ejecutar `pnpm --filter @poker/shared test`: comprobar fallo por reglas ausentes.
- [x] Implementar esquemas y estadísticas con estas aserciones: votos 1, 3, ?, ☕ producen promedio 2 y mediana 2; votos solo especiales no producen promedio ni consenso; S/S da consenso sin promedio; 1/3/3 da mediana 3; etiquetas duplicadas o reservadas y números infinitos se rechazan. Fibonacci coincide con 0,1,2,3,5,8,13,21,34,55,89.
- [x] Ejecutar pruebas y typecheck del paquete: todo pasa.
- [x] Guardar un commit si hay repositorio Git; no bloquear la ejecución si aún no existe.

## Task 2: SQLite, identidad y creación/ingreso

**Files:** Crear `apps/server/package.json`, `apps/server/src/{app,config}.ts`, `apps/server/src/db/{database,migrations}.ts`, `apps/server/src/sessions/{identity,repository,service,routes,snapshot}.ts`, `apps/server/tests/sessions.test.ts`.

**Interfaces:** Consume contratos de tarea 1. Produce `openDatabase(path: string): Database`, `createApp(deps: AppDependencies): Hono`, `resolveActor(cookie: string | undefined): Actor | null`, `createSession(actor: Actor, input: CreateSessionInput): SessionSnapshot`, `joinSession(actor: Actor, code: string, input: JoinSessionInput): SessionSnapshot`, `getSnapshot(actor: Actor, code: string): SessionSnapshot`. Servicios reciben Database mediante construcción, sin singleton global.

- [x] Escribir integración que crea dos sesiones, ingresa dos personas con igual nombre, niega acceso cruzado y restaura identidad desde cookie. Comprobar que repetir creación con igual requestId no crea otra sesión.
- [x] Ejecutar `pnpm --filter @poker/server test sessions`: comprobar fallo inicial.
- [x] Implementar migraciones con claves externas, unicidad y transacciones; cookie HttpOnly, SameSite=Lax, Secure configurable; almacenar solo hash de credencial. Crear tablas de sesiones, credenciales, participantes, tareas, rondas, votos e idempotencia. Serializar escala por ronda y revisión por sesión.
- [x] Implementar rutas, validación de origen, límites de frecuencia y errores comunes. Probar código inválido y sesión cerrada; abrir otra conexión a la base para comprobar persistencia.
- [x] Ejecutar integración y typecheck; guardar commit si está disponible.

## Task 3: Tareas, moderación y ciclo de votación

**Files:** Crear `apps/server/src/sessions/{commands,tasks,rounds,permissions}.ts`, `apps/server/tests/{tasks,rounds,permissions}.test.ts`; modificar `service.ts`, `routes.ts`, `snapshot.ts`.

**Interfaces:** Produce `executeCommand(actor: Actor, code: string, command: Command): SessionSnapshot`; consume getSnapshot y contratos. Tras éxito incrementa revisión y notifica mediante callback `onSessionChanged(sessionId: string): void` después de commit.

- [x] Escribir pruebas: no moderador no modifica tareas; solo una ronda abierta; voto actualizable antes de revelar y rechazado después; instantáneas de otro actor omiten el valor aun para moderador; guardar exige estimación ordinaria de escala.
- [x] Ejecutar `pnpm --filter @poker/server test`: comprobar fallos de nuevas pruebas.
- [x] Implementar comandos en transacciones, con conflictos 409 por revisión obsoleta. Repetición conserva historia y vacía votos; volver a estimar conserva resultado previo hasta guardar. Cambiar escala no modifica rondas históricas. Selección/cierre/eliminación rechazan acciones incompatibles hasta descarte explícito.
- [x] Añadir pruebas de carrera voto/revelado con dos conexiones: voto confirmado antes entra en resultados; voto procesado después se rechaza. Probar idempotencia de task.add tras perder respuesta, transferencia atómica, modo facilitador, reordenación como permutación exacta y selección de siguiente pendiente.
- [x] Ejecutar todas las pruebas de servidor y tipos; guardar commit si está disponible.

## Task 4: Sincronización y reconexión

**Files:** Crear `apps/server/src/realtime/{hub,websocket}.ts`, `apps/server/src/index.ts`, `apps/server/tests/realtime.test.ts`; modificar `app.ts` y servicio.

**Interfaces:** Produce `createHub(getAuthorizedSnapshot): {publish(sessionId: string): void; connect(...): void; disconnect(...): void}`. Hono Node sirve HTTP y WebSocket; cada conexión está vinculada a actor y sesión verificados. Reutiliza getSnapshot por destinatario, sin difundir una instantánea común con votos privados.

- [x] Escribir prueba con servidor local efímero y dos clientes: voto oculto antes de revelar, visible después, ninguna actualización cruza de sesión.
- [x] Ejecutar `pnpm --filter @poker/server test realtime`: comprobar fallo.
- [x] Implementar hub, publicación posterior a commit, presencia contada por conexiones y heartbeat con limpieza de conexiones muertas. Validar origen y pertenencia antes del upgrade; enviar instantánea al conectar y tras mutaciones/presencia.
- [x] Probar dos pestañas con misma identidad: un participante visible, un voto persistido, presencia activa mientras quede una conexión. Reiniciar servidor usando misma base: recuperar ronda y voto con nueva conexión.
- [x] Ejecutar integración completa y tipos; guardar commit si está disponible.

## Task 5: Interfaz completa

**Files:** Crear `apps/web/{package.json,index.html,vite.config.ts}`, `apps/web/src/{main,App}.tsx`, `apps/web/src/{api,useSession}.ts`, `apps/web/src/components/{Home,Session,Participants,TaskList,TaskEditor,VotingDeck,Results,ScaleEditor,ModeratorControls,ConfirmDialog}.tsx`, `apps/web/src/styles.css`, `apps/web/tests/session.spec.ts`, `playwright.config.ts`.

**Interfaces:** Consume rutas y SessionSnapshot. `api.command(code: string, command: Command): Promise<SessionSnapshot>`. `useSession(code: string)` expone estado, conectividad y envío; ignora revisiones inferiores, no reenvía comandos automáticamente y resincroniza ante 409 o respuesta perdida.

- [x] Aplicar Impeccable, solicitado explícitamente por el usuario, y el contexto de PRODUCT.md y DESIGN.md. Implementar la dirección aprobada «Menta social», propuesta 03: fondos menta, verde profundo, acentos durazno y lavanda, mesa compartida y cartas protagonistas. Distinguir claramente ausencia de voto de la carta especial ?. Leer craft-floor inmediatamente antes de implementar. Revisar escritorio y móvil en una ronda conjunta, corregir en lote y realizar como máximo una ronda adicional de confirmación.
- [x] Escribir flujo Playwright con dos contextos: crear, unirse, agregar tarea, abrir ronda, votar, revelar, elegir resultado y avanzar. Ejecutarlo y comprobar fallo por interfaz ausente.
- [x] Implementar inicio, enlace/código, persistencia mediante cookie y navegación a sesión. Implementar panel derecho, formularios de tareas, selección de escala, cartas y controles moderador, con confirmaciones de eliminación/descarte.
- [x] Implementar estados de carga, errores, sesión cerrada, sin tareas, sin votos, desconexión y recuperación. Mostrar distribución/estadísticas según escala, historial de rondas y estimación elegida. Permitir transferir rol y modo facilitador.
- [x] Extender flujo con repetir ronda, recargar, transferencia, cambio de escala y modo facilitador. Probar nombre `<script>`, descripción de 5000 caracteres y viewport 390px: texto literal, sin desbordamiento horizontal, panel utilizable. Revisar teclado, foco, etiquetas y contraste.
- [x] Ejecutar Playwright, typecheck y build. Inspeccionar visualmente escritorio/móvil; guardar commit si está disponible.

## Task 6: Docker, documentación y verificación final

**Files:** Crear `Dockerfile`, `compose.yaml`, `.dockerignore`, `README.md`; modificar `apps/server/src/{index,config}.ts` para servir frontend y cierre limpio.

**Interfaces:** `PORT` por defecto 3000, `DATABASE_PATH=/data/poker.sqlite`, `PUBLIC_ORIGIN` para origen esperado, `COOKIE_SECURE` para HTTPS. `GET /health` comprueba servicio y acceso SQLite sin exponer datos. Frontend y API bajo mismo puerto.

- [x] Escribir prueba de /health y fallback SPA: rutas de navegación reciben HTML; rutas API desconocidas devuelven JSON 404. Ejecutar para comprobar fallo inicial.
- [x] Implementar archivos estáticos, configuración validada, healthcheck, cierre de conexiones y base ante SIGTERM. Construir imagen multietapa, instalar dependencias nativas SQLite en etapa de build y ejecutar como usuario no root con volumen escribible.
- [x] Documentar `pnpm install`, desarrollo, pruebas, `docker compose up --build`, variables, ruta/backup del volumen y limitación de una réplica. No configurar ni contratar VPS.
- [x] Ejecutar `pnpm test`, `pnpm typecheck`, `pnpm build` y pruebas Playwright. Construir Docker, arrancar, comprobar salud y flujo con dos clientes, reiniciar sin borrar volumen y verificar datos e identidad. Si Docker no está disponible, registrar esa verificación como pendiente, sin afirmar que pasó.
- [x] Revisar cambios contra especificación y corregir defectos; entregar instrucciones de arranque y resultados reales de verificación. Guardar commit si está disponible.

## Revisión del plan

Las seis tareas cubren arquitectura, identidad, roles, tareas, escalas, rondas, estadísticas, historia, persistencia, privacidad, reconexión, errores, UI y Docker. Los cinco casos de Review Focus tienen pruebas asignadas. No se añade trabajo de hosting ni integraciones externas.

