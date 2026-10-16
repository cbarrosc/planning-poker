# Investigación de cartas bloqueadas — 2026-10-16

Reporte: durante una sesión en VPS con unos diez usuarios, las cartas dejaron de responder y fue necesario refrescar una vez.

## Reproducción local

La reproducción original se ejecutó con Edge contra el servidor compilado y una base de pruebas independiente, usando diez contextos de navegador con identidades distintas. `apps/web/tests/voting-recovery.spec.ts` convierte ese escenario en pruebas de recuperación sin recargar.

- Cinco rondas con diez votos simultáneos cada una: los 50 votos llegan correctamente; no se reproduce el bloqueo por carga normal.
- Cierre explícito de WebSocket de un participante: aparece la reconexión y las cartas se habilitan automáticamente sin refrescar.
- Retención de una respuesta HTTP después de que el servidor acepta un voto: el moderador recibe ese voto por WebSocket, pero las cartas del participante siguen deshabilitadas durante más de diez segundos. Recargar permite volver a votar.

La retención de respuesta es un fallo de transporte simulado, no una medición del VPS. El bloqueo dura mientras la petición siga pendiente; la prueba observa diez segundos, no espera indefinidamente.

## Causa del escenario reproducido

`apps/web/src/api.ts` llama a `fetch` y lee el JSON sin tiempo límite. `useSession.send` activa `busy` y `sending` hasta terminar esa petición. Si la respuesta o su cuerpo quedan pendientes, no se ejecuta `finally`: las cartas permanecen deshabilitadas aunque lleguen snapshots por WebSocket. La reconexión del socket tampoco libera esa operación HTTP pendiente.

Esto reproduce el síntoma reportado, pero no prueba que esa fuera la causa del incidente en producción. No se inspeccionaron registros, proxy ni tráfico del VPS. Tampoco se descartan otros fallos, como una conexión WebSocket que deja de transmitir sin emitir cierre al navegador.

## Solución candidata en rama separada

Las peticiones HTTP tienen un tiempo límite de 15 segundos, incluida la lectura del cuerpo. El temporizador se limpia al finalizar. La consulta de resincronización también está limitada: los controles se liberan en aproximadamente 15 segundos si esa consulta responde, o 30 segundos si ambas peticiones quedan pendientes, con temporizadores activos. Una pestaña suspendida puede demorar esos tiempos.

Un timeout no implica que el servidor haya rechazado el voto: se conserva el identificador idempotente de la operación pendiente para reintentar sin duplicarla. Una consulta HTTP de resincronización fallida no cambia el estado del WebSocket a desconectado; su propio ciclo de conexión sigue controlando ese estado.

Las pruebas de navegador exigen recuperar las cartas sin refrescar tanto con la respuesta del voto retenida como con el voto y la resincronización retenidos; verifican que el reintento envía el mismo identificador. Las pruebas unitarias cubren timeout antes de cabeceras, durante la lectura del cuerpo y limpieza del temporizador.

Esta solución no se ha desplegado en el VPS ni demuestra la causa del incidente original. No cambia el tratamiento de conexiones WebSocket silenciosamente interrumpidas.
