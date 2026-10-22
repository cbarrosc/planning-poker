# Arquitectura C4 — Planning Poker

Estos diagramas describen la implementación actual. El alcance de despliegue es una **VPS privada** o un **equipo anfitrión en una LAN**. Se usa Mermaid con notación de personas, sistemas, contenedores y componentes mediante `flowchart`; el nivel de código usa `classDiagram`.

En C4, un contenedor es una aplicación o almacén de datos: no equivale necesariamente a un contenedor Docker. La interfaz se ejecuta en el navegador; el servidor y el archivo SQLite comparten un único contenedor Docker en producción.

## C1 — Contexto del sistema

```mermaid
flowchart LR
    moderator["Persona: moderador<br/>Crea sesiones, administra tareas y dirige rondas"]
    participant["Persona: participante<br/>Se une, vota y consulta resultados"]
    operator["Persona: administrador del anfitrión<br/>Inicia el servicio, controla acceso y respalda datos"]
    system["Sistema: Planning Poker<br/>Estimación colaborativa en tiempo real<br/>Accesible en LAN o VPS privada"]

    moderator -->|"Usa desde su navegador"| system
    participant -->|"Usa desde su navegador"| system
    operator -->|"Despliega y mantiene"| system
```

El moderador también puede votar o facilitar sin votar. No hay dependencias de servicios externos para realizar estimaciones. Compartir el enlace o código se hace fuera del sistema.

## C2 — Contenedores

```mermaid
flowchart LR
    person["Persona: moderador o participante"]
    subgraph system["Sistema: Planning Poker"]
        spa["Contenedor: aplicación web<br/>React + TypeScript, compilada con Vite<br/>Se ejecuta en el navegador"]
        server["Contenedor: servidor<br/>Node.js 24 + Hono + ws<br/>API, identidad, reglas y sincronización"]
        db[("Contenedor: almacén SQLite<br/>Archivo poker.sqlite<br/>Sesiones, credenciales y solicitudes idempotentes")]
    end
    person -->|"Interactúa"| spa
    server -->|"Entrega HTML, CSS y JavaScript por HTTP o HTTPS"| spa
    spa -->|"HTTP o HTTPS: consultas y comandos JSON, cookie de identidad"| server
    server -->|"WebSocket: snapshots personalizados y presencia"| spa
    server -->|"SQL local mediante node:sqlite"| db
```

- La web y la API comparten origen. En producción, Hono entrega también los archivos estáticos.
- Los comandos, incluidos los votos, se envían por HTTP; WebSocket distribuye snapshots del estado y mantiene la presencia.
- SQLite es una biblioteca integrada y un archivo local, sin servidor de base de datos separado.
- `packages/shared` es una biblioteca compilada con los consumidores, no un servicio desplegable.
- Hay una sola réplica del servidor: las conexiones WebSocket, la presencia y los límites de frecuencia viven en memoria.

## C3 — Componentes del servidor

```mermaid
flowchart TB
    web["Aplicación web<br/>React: api.ts y useSession.ts"]
    subgraph server["Contenedor: servidor Node.js"]
        runtime["Arranque y transporte<br/>index.ts, config.ts, runtime.ts<br/>Configura HTTP y upgrade WebSocket"]
        http["API y middleware<br/>app.ts<br/>Rutas, cookie, origen, límites y archivos estáticos"]
        service["Servicio de sesiones<br/>sessions/service.ts<br/>Identidad, transacciones e idempotencia"]
        commands["Reglas de comandos<br/>sessions/commands.ts y model.ts<br/>Permisos, revisión y transiciones de ronda"]
        projection["Proyección por participante<br/>sessions/snapshot.ts<br/>Oculta votos ajenos antes de revelar"]
        repo["Repositorio<br/>sessions/repository.ts<br/>Agregados JSON y solicitudes procesadas"]
        database["Acceso a SQLite<br/>db/database.ts<br/>Esquema, WAL y BEGIN IMMEDIATE"]
        hub["Hub de tiempo real<br/>realtime/hub.ts<br/>Conexiones, presencia, heartbeat y publicación"]
    end
    shared["Biblioteca compartida: packages/shared<br/>Contratos Zod, escalas y estadísticas"]
    db[("Archivo SQLite")]

    web -->|"Consultas y comandos HTTP"| http
    runtime -->|"Construye y conecta"| http
    runtime -->|"Construye y conecta"| hub
    http -->|"Invoca"| service
    http -->|"Valida entradas con"| shared
    service -->|"Aplica"| commands
    service -->|"Genera respuesta con"| projection
    service -->|"Carga, guarda y deduplica con"| repo
    service -->|"Transacciones e identidad"| database
    repo -->|"SQL mediante DatabaseSync"| db
    database -->|"Inicializa y accede"| db
    service -->|"Notifica cambios confirmados"| hub
    hub -->|"Consulta snapshot y aporta presencia"| service
    hub -->|"Envía snapshots por WebSocket"| web
    commands -->|"Usa contratos"| shared
    projection -->|"Calcula estadísticas con"| shared
```

El servicio consulta directamente la tabla de credenciales para resolver la identidad; el repositorio encapsula las sesiones y la deduplicación. El hub solicita una proyección para cada identidad conectada: no transmite el agregado persistido completo.

## C3 — Componentes de la aplicación web

```mermaid
flowchart LR
    subgraph browser["Contenedor: aplicación web en el navegador"]
        app["App y Home<br/>Entrada, creación e ingreso a sesiones"]
        session["Session<br/>Coordina la vista de la sesión"]
        ui["Componentes de interacción<br/>VotingDeck, TaskList, Participants,<br/>ModeratorControls, ScaleEditor y Results"]
        state["useSession<br/>Estado, revisiones, reconexión<br/>y recuperación de comandos inciertos"]
        api["api.ts y requestId.ts<br/>Peticiones JSON, identidad<br/>e identificadores de solicitud"]
    end
    server["Servidor: API y hub WebSocket"]
    app -->|"Abre"| session
    app -->|"Crea o une"| api
    session -->|"Compone"| ui
    session -->|"Consulta estado y envía acciones"| state
    state -->|"Consulta y envía comandos"| api
    api -->|"HTTP o HTTPS con cookie"| server
    server -->|"Snapshots por WebSocket"| state
```

## C4 — Código: núcleo de sesiones

Vista selectiva de los tipos y relaciones principales; no es un inventario exhaustivo. `applyCommand` y `snapshot` son funciones, representadas como módulos.

```mermaid
classDiagram
    class SessionService {
        repo: Repository
        db: DatabaseSync
        identity(token, required)
        createSession(actor, input)
        joinSession(actor, code, input)
        executeCommand(actor, code, input)
        getSnapshot(actor, code)
        onSessionChanged(code)
        isOnline(participantId)
    }
    class Repository {
        load(code)
        save(state)
        previous(actor, requestId, fingerprint)
        remember(actor, requestId, fingerprint, state)
    }
    class SessionState {
        id: string
        code: string
        revision: number
        moderatorId: string
        activeTaskId: string
        activeRoundId: string
        participants
        tasks
        rounds
        scale
    }
    class CommandRules {
        <<module>>
        applyCommand(state, actor, command)
    }
    class SnapshotProjection {
        <<module>>
        snapshot(state, actor, isOnline)
    }
    class SessionSnapshot {
        <<contract>>
    }
    class DatabaseSync {
        <<node_sqlite>>
        prepare(sql)
        exec(sql)
    }
    SessionService --> Repository : usa
    SessionService --> DatabaseSync : transacciones e identidad
    Repository --> DatabaseSync : consulta y persiste
    Repository --> SessionState : carga y guarda
    SessionService --> CommandRules : aplica reglas
    SessionService --> SnapshotProjection : proyecta estado
    CommandRules --> SessionState : modifica e incrementa revision
    SnapshotProjection --> SessionState : lee
    SnapshotProjection --> SessionSnapshot : produce por identidad
```

`activeTaskId` y `activeRoundId` pueden ser nulos. Antes de aplicar un comando se comprueba su idempotencia; los cambios se confirman en SQLite antes de notificar al hub. Las reglas validan pertenencia, permisos y revisión, con tratamiento específico para votos concurrentes de una misma ronda abierta.

## Despliegue A — Equipo local en LAN

```mermaid
flowchart TB
    subgraph lan["Red local privada: LAN o Wi-Fi"]
        browsers["Equipos y teléfonos del equipo<br/>Navegadores con la aplicación web"]
        subgraph host["Equipo anfitrión encendido"]
            firewall["Firewall del anfitrión<br/>Permite TCP PORT desde la LAN"]
            subgraph docker["Docker Compose: servicio poker, una instancia"]
                node["Node.js 24<br/>Web estática + API + WebSocket<br/>Puerto interno 3000"]
            end
            volume[("Volumen poker-data<br/>/data/poker.sqlite y archivos WAL")]
        end
    end
    browsers -->|"HTTP y WS a IP del anfitrión:PORT"| firewall
    firewall -->|"Puerto publicado PORT hacia 3000"| node
    node -->|"Lectura y escritura local en /data"| volume
```

- Inicio: `docker compose up --build -d`. Solo el anfitrión necesita Docker.
- Dirección compartida: `http://IP-DEL-ANFITRION:3000`, o el `PORT` elegido. El anfitrión usa esa misma dirección para conservar origen e identidad.
- Configuración: `PUBLIC_ORIGIN=` y `COOKIE_SECURE=false`.
- No requiere abrir puertos del router. El anfitrión debe permanecer encendido y accesible desde la LAN.

## Despliegue B — VPS privada

La siguiente es la topología propuesta para operar de forma privada. La aplicación y el volumen están definidos en el repositorio; el acceso privado, proxy, certificados y reglas de red se configuran fuera de este proyecto.

```mermaid
flowchart TB
    clients["Dispositivos autorizados<br/>Navegadores con la aplicación web"]
    access["Acceso privado<br/>VPN o red privada con rutas y reglas de acceso"]
    subgraph vps["VPS privada"]
        firewall["Firewall<br/>Permite entrada solo desde la red autorizada"]
        proxy["Proxy inverso con TLS<br/>Dominio privado y certificado<br/>Conserva Origin y permite upgrade WebSocket"]
        subgraph docker["Docker Compose: servicio poker, una instancia"]
            node["Node.js 24<br/>Web estática + API + WebSocket<br/>Puerto interno 3000"]
        end
        volume[("Volumen poker-data<br/>/data/poker.sqlite y archivos WAL")]
    end
    clients -->|"Conectividad privada"| access
    access -->|"HTTPS y WSS, puerto 443"| firewall
    firewall -->|"Tráfico autorizado"| proxy
    proxy -->|"HTTP y WS al puerto publicado del servicio"| node
    node -->|"Lectura y escritura local en /data"| volume
```

- Configuración de ejemplo: `PUBLIC_ORIGIN=https://poker.dominio-interno` y `COOKIE_SECURE=true`; el origen debe coincidir exactamente con el utilizado por los navegadores.
- El proxy termina TLS y reenvía HTTP y WebSocket. HTTPS protege el transporte; el carácter privado lo establecen las rutas, VPN y reglas de acceso.
- El Compose actual publica `${PORT:-3000}:3000` sin restringir la dirección de escucha del host. Para esta topología, debe impedirse el acceso directo no autorizado a ese puerto mediante la configuración de publicación y red del despliegue; el proxy no basta por sí solo.
- No hay autenticación corporativa integrada. La cookie HttpOnly identifica al navegador y el servidor controla pertenencia y rol dentro de cada sesión.
- Mantener una sola réplica. La base y los archivos WAL deben persistir en el volumen; las copias coherentes se realizan con el servicio detenido según el README.

## Correspondencia con el repositorio

| Elemento | Fuente |
| --- | --- |
| Arranque y configuración | `apps/server/src/index.ts`, `config.ts`, `runtime.ts` |
| API, identidad HTTP y archivos estáticos | `apps/server/src/app.ts` |
| Servicio, reglas, modelo y proyección | `apps/server/src/sessions/` |
| Persistencia | `apps/server/src/db/database.ts`, `sessions/repository.ts` |
| Tiempo real y presencia | `apps/server/src/realtime/hub.ts` |
| Aplicación web y sincronización | `apps/web/src/` |
| Contratos, escalas y estadísticas | `packages/shared/src/` |
| Empaquetado y despliegue | `Dockerfile`, `compose.yaml`, `README.md` |
