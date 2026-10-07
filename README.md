# Planning Poker

Estima tareas en equipo, en tiempo real. Interfaz en español con la dirección visual **Menta social**. Monorepo TypeScript: React + Vite, Hono sobre Node.js, WebSocket y SQLite.

## Arrancar con Docker

```sh
docker compose up --build -d
```

Abre http://localhost:3000. Crea una sesión e invita a tu equipo mediante código o enlace. Quien crea la sesión modera; puede votar o facilitar y transferir su rol. Cada navegador conserva su identidad mediante cookie. Si se elimina esa cookie, se pierde acceso a esa identidad, incluido el rol de moderador; el nombre no permite recuperarlo.

El volumen `poker-data` conserva sesiones, tareas, rondas y votos al reiniciar. `docker compose down` conserva el volumen; `down -v` lo elimina junto con los datos. No se requiere otro servicio. La versión inicial funciona con una sola réplica del servidor.

Para el VPS que proporcionará tu colega, copia `.env.example` a `.env` y establece `PUBLIC_ORIGIN=https://tu-dominio` y `COOKIE_SECURE=true` cuando haya HTTPS. El proxy debe conservar Origin, transmitir WebSocket y enviar tráfico al puerto 3000 del contenedor. El puerto publicado se configura mediante `PORT`; si lo cambias para acceso directo, ajusta también `PUBLIC_ORIGIN`. No se incluye configuración ni administración del VPS.

## Desarrollo

Requiere **Node.js 24** y pnpm 11.25.0. SQLite utiliza el módulo incorporado en Node; no requiere compilación de extensiones nativas.

```sh
pnpm install
pnpm dev
```

Frontend: http://localhost:5173. Backend: puerto 3000. Para desarrollo, inicia con `PUBLIC_ORIGIN=http://localhost:5173`; sin esa variable, el proxy de Vite conserva el origen local. Base de datos de desarrollo: `apps/server/data/poker.sqlite`, relativa al directorio del servidor. La aplicación compilada usa `data/poker.sqlite` desde la raíz.

```sh
pnpm test
pnpm typecheck
pnpm exec playwright install chromium
pnpm build
pnpm test:e2e
pnpm start
```

Playwright prueba el servidor compilado en puerto 3100 y crea una base independiente en `data/e2e.sqlite`. Opcionalmente `PLAYWRIGHT_CHANNEL=msedge` usa Edge instalado; `E2E_PORT` cambia el puerto de pruebas si está ocupado. Los tests del servidor cubren privacidad, permisos, identidad, persistencia, estadísticas, transacciones y varias conexiones reales WebSocket. Los tests de navegador cubren también móvil y pérdida de respuestas después de guardar.

## Uso

1. Crear sesión: nombre, nombre de sesión y escala.
2. Compartir enlace/código. Los participantes ingresan con su nombre.
3. El moderador agrega y selecciona tareas en el panel derecho; en móvil se abre con el botón de tareas.
4. Iniciar votación. Cada persona puede cambiar su carta hasta revelar. `?` expresa duda y café pide una pausa.
5. Revelar y conversar: las estadísticas excluyen cartas especiales y personas sin voto. Las tallas no tienen promedio a menos que se configure una escala con valores numéricos.
6. Repetir o elegir la estimación final; guardar y pasar a la siguiente tarea.

La escala personalizada admite etiquetas separadas por comas y valores opcionales: `S=1, M=3, L=5`. Las etiquetas deben ser únicas; `?` y café se agregan automáticamente. Cambiar escala no reinterpreta resultados históricos. Al descartar se conservan los datos internos de ronda, pero ya no se muestran votos ni estadísticas de esa ronda. Eliminar una tarea elimina su historial tras confirmación.

## Configuración del servidor

| Variable | Valor inicial | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Puerto HTTP del servidor; Compose mantiene 3000 interno |
| `DATABASE_PATH` | `data/poker.sqlite` | Archivo SQLite; Docker usa `/data/poker.sqlite` |
| `PUBLIC_ORIGIN` | Origen de la petición | Origen permitido para escritura y WebSocket; fijarlo detrás del proxy |
| `COOKIE_SECURE` | `false` | Usar `true` con HTTPS |
| `WEB_ROOT` | `apps/web/dist` | Frontend compilado |

`GET /health` comprueba acceso a SQLite. La cookie es HttpOnly, SameSite=Lax y dura un año. SQLite guarda el hash de la credencial, no el secreto. Los votos ajenos no se envían antes del revelado. Límites de frecuencia: 10 creaciones y 60 intentos de ingreso por minuto por IP; con proxy los clientes pueden compartir ese límite. Las sesiones no caducan automáticamente.

## Copia de seguridad

Para obtener una copia coherente, detén el servicio y copia el volumen completo, incluidos posibles archivos WAL:

```sh
docker compose stop poker
docker compose run --rm --no-deps --user root -v "${PWD}:/backup" poker sh -c 'tar czf /backup/poker-backup.tar.gz -C /data .'
docker compose start poker
```

Guarda la copia fuera del servidor. Para restaurar, detén el servicio y extrae la copia en su volumen `/data`, conservando propietario y permisos del usuario `node`.

## Estructura

- `apps/web`: interfaz, conexión y componentes.
- `apps/server`: API, reglas, SQLite y sincronización.
- `packages/shared`: contratos, validación, escalas y estadísticas.
- `docs/superpowers`: especificación y plan acordados.

Los datos de cada sesión se guardan como un agregado JSON dentro de SQLite y se actualizan con transacciones `BEGIN IMMEDIATE`; credenciales y solicitudes idempotentes usan tablas separadas. Esto mantiene el despliegue simple y preserva consistencia para una réplica.
