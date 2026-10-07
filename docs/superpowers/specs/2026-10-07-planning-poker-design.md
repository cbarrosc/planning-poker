# Planning Poker online — especificación

Fecha: 2026-10-07. Estado: aprobada por el usuario.

## Objetivo y alcance

Aplicación para estimar tareas en equipo en tiempo real. Permite múltiples sesiones independientes sin cuentas de usuario, con un moderador por sesión. Se despliega en un único contenedor Docker con SQLite persistente en un volumen. Interfaz inicial en español y adaptable a escritorio y móvil.

Incluye creación e ingreso a sesiones, tareas, votación oculta, revelado, estadísticas, repetición de rondas y estimación final elegida por el moderador. No incluye integraciones, autenticación corporativa, chat ni despliegue de varias réplicas.

## Arquitectura

Monorepo TypeScript con pnpm workspaces:

- `apps/web`: React y Vite; interfaz y conexión en tiempo real.
- `apps/server`: Node.js y Hono; HTTP, WebSocket, reglas de negocio y SQLite.
- `packages/shared`: esquemas de validación, contratos y definiciones de escalas compartidas.

El backend sirve el frontend compilado y la API bajo el mismo origen. HTTP procesa comandos; WebSocket transmite cambios confirmados y presencia. El servidor es la autoridad sobre permisos, estado de ronda, votos y estadísticas. Ninguna regla depende exclusivamente del frontend.

Una instancia del servidor atiende varias sesiones; mantiene conexiones y presencia en memoria, y datos duraderos en SQLite. No se requiere Redis ni un servicio externo. Docker Compose publica un puerto y monta `/data` para la base de datos. La imagen se construye en etapas y se ejecuta como usuario sin privilegios. Se documentarán desarrollo, construcción, arranque y copia de seguridad.

## Entrada e identidad

Inicio con Crear sesión y Unirse a sesión. Para crear se solicita nombre del participante, nombre de sesión y escala; Fibonacci es el valor inicial. Crear entrega un código único y un enlace compartible. Para unirse se requiere código o enlace y nombre.

Cada participante recibe una credencial aleatoria no deducible, guardada en una cookie HttpOnly del mismo origen; el servidor conserva su hash y vincula la credencial con sus participaciones. Los nombres no acreditan identidad ni conceden permisos. Recargar o reconectar restaura la participación mientras exista la cookie. Borrar la cookie pierde ese acceso; no se permite recuperar al moderador con solo su nombre.

Cada sesión tiene exactamente un moderador. El creador asume el rol y puede transferirlo de manera atómica a otro participante. Desconectarse no transfiere el rol automáticamente. El moderador puede cerrar la sesión: queda disponible para consultar los resultados a sus participantes, pero no admite nuevas entradas ni modificaciones.

## Pantalla de sesión

Cabecera con nombre, código/enlace para compartir y estado de conexión. Centro con tarea activa, participantes, estado de voto y cartas disponibles; al revelar se muestran votos y resultados. Lateral derecho con tareas pendientes y estimadas. En móvil la lista se abre en un panel.

Solo el moderador agrega, edita, ordena, elimina y selecciona tareas. Una tarea contiene título obligatorio, descripción opcional y posición. Eliminar una tarea con resultados requiere confirmación en la interfaz. La tarea activa no se elimina durante una ronda abierta. Seleccionar otra tarea durante una votación requiere descartar explícitamente la ronda actual.

Participantes ven quién está conectado y quién ha votado, pero no el valor elegido por otros antes del revelado. El moderador dispone de la misma información de voto que los demás. Puede elegir participar o solo facilitar antes de empezar una ronda; el modo queda fijado para esa ronda.

## Rondas y resultados

Estados: sin ronda, votación abierta, revelada y finalizada. Seleccionar una tarea no inicia automáticamente la ronda. El moderador abre la votación; cada participante elegible puede votar y cambiar su voto hasta revelar. Participantes que ingresan durante una ronda abierta pueden votar. Una desconexión conserva el voto y se muestra como tal.

Solo el moderador revela, aun si faltan votos. Revelar congela las elecciones. Repetir archiva la ronda revelada y abre otra con votos vacíos para la misma tarea. Guardar exige una ronda revelada y una estimación perteneciente a la escala; finaliza la ronda y marca la tarea como estimada. Avanzar selecciona la siguiente tarea pendiente sin iniciar votación. Una tarea estimada se puede volver a votar; la estimación anterior se conserva hasta guardar la nueva.

Cada ronda guarda una copia de su escala. Cambiar escala solo se permite cuando no hay una votación abierta y afecta a las rondas siguientes, sin reinterpretar resultados anteriores. Cerrar la sesión con una votación abierta exige descartarla explícitamente.

## Escalas y estadísticas

- Fibonacci: 0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89.
- Camisetas: XS, S, M, L, XL, XXL, sin equivalencias numéricas iniciales.
- Personalizada: lista ordenada de etiquetas únicas; cada etiqueta puede tener un valor numérico finito no negativo. Las etiquetas `?` y `☕` están reservadas.

Todas incluyen `?` y `☕` como votos especiales. No cuentan como estimación final ni entran en promedio, mediana o consenso. Ausencia de voto tampoco cuenta como cero.

Después de revelar se presenta distribución de todas las elecciones y cantidad de votos válidos. Promedio y mediana se muestran solo si todas las cartas ordinarias de la escala tienen valor numérico; de lo contrario se muestra distribución y moda. Promedio y mediana usan solo votos ordinarios emitidos y se muestran con hasta dos decimales; sin valores válidos se muestra “Sin votos estimables”. Consenso significa que todos los votos ordinarios emitidos coinciden, indicando separadamente abstenciones, votos especiales y participantes sin votar; no se afirma consenso si no existen votos ordinarios. El moderador selecciona siempre la estimación final, sin redondeo ni guardado automáticos.

## Persistencia y sincronización

Entidades: sesiones, credenciales, participantes por sesión, tareas, rondas y votos. Restricciones: código único, un moderador por sesión, una ronda abierta por sesión y un voto por participante/ronda. Mutaciones de votos, cambios de estado, transferencia de rol y guardado de estimaciones usan transacciones.

Toda mutación valida identidad, pertenencia, rol cuando corresponda y estado vigente. Cada sesión tiene una revisión creciente. Los eventos se publican después de confirmar la transacción. Al reconectar se recibe una instantánea autorizada; eventos desactualizados no sobrescriben estado más reciente. La presencia se calcula desde conexiones activas; al reiniciar todos aparecen desconectados hasta reconectar, pero se conservan sesiones y rondas.

Antes de revelar, las respuestas HTTP, instantáneas y eventos omiten votos ajenos y estadísticas que permitan inferirlos. Un participante puede recuperar su propio voto. Se valida el origen de conexiones y solicitudes de escritura; las credenciales no aparecen en enlaces ni registros. La entrada y creación de sesiones tienen límites de frecuencia, y títulos, nombres, descripciones y escalas tienen límites de tamaño definidos en contratos compartidos.

## Errores y recuperación

Mensajes claros para código inexistente, sesión cerrada, credencial inválida, permiso insuficiente, entrada inválida y conflicto de estado. Una operación incompatible con un cambio concurrente se rechaza y actualiza el cliente. Durante una desconexión se informa al usuario y se deshabilitan mutaciones; al reconectar se restaura la instantánea antes de habilitarlas. Los comandos no se reenvían automáticamente: ante respuesta perdida se consulta el estado para evitar duplicados. Crear tareas y sesiones admite clave de idempotencia.

## Verificación y aceptación

Pruebas de reglas: escalas, estadísticas, votos especiales, estados y estimación final. Pruebas de integración con SQLite: aislamiento entre sesiones, permisos, secreto de votos, transacciones, identidad y persistencia tras reiniciar. Prueba de flujo con dos participantes: crear, unirse, votar, revelar, repetir, guardar, avanzar y reconectar. Comprobar transferencia de moderador y modo facilitador.

Verificar compilación y tipos del monorepo, construcción Docker, arranque con volumen, endpoint de salud, WebSocket y recuperación tras reinicio. Revisar interfaz en escritorio y móvil, navegación con teclado, foco visible y estados de conexión/error. El resultado debe arrancar con `docker compose up --build`, documentando puerto y volumen.

## Decisiones operativas

La versión inicial soporta una sola réplica y varias sesiones simultáneas, sin prometer un número ilimitado de usuarios. No hay borrado automático ni caducidad de sesiones en esta versión. El VPS será proporcionado por un colega del usuario. El alcance se limita a entregar la aplicación y su configuración Docker; no incluye contratar, administrar ni publicar hosting. El entorno de despliegue proporciona HTTPS y soporte WebSocket mediante su proxy.
