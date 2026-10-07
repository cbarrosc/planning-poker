# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TypeScript en monorepo pnpm, React + Vite, Hono sobre Node.js y SQLite. Arquitectura aprobada por el usuario.

## Users

Equipos que estiman tareas juntos, con un moderador y participantes que ingresan mediante enlace o código y nombre, sin cuentas.

## Product Purpose

Facilitar votaciones simultáneas y secretas, revelar resultados para discutirlos y guardar una estimación elegida por el moderador para cada tarea.

## Operating Context

Sesiones compartidas en tiempo real. Lista de tareas a la derecha en escritorio y panel desplegable en móvil. El moderador puede votar o solo facilitar.

## Capabilities and Constraints

Varias sesiones independientes; escalas Fibonacci, camisetas y personalizadas; votos ? y café; estadísticas numéricas cuando corresponda. Persistencia en volumen Docker. Una réplica en VPS proporcionado por un colega del usuario; administración del hosting fuera de alcance. Reglas completas en docs/superpowers/specs/2026-10-07-planning-poker-design.md.

## Brand Commitments

El usuario pide una estética atractiva, colorida y amigable, desarrollada con Impeccable. Interfaz en español. Nombre comercial, logotipo y referencias visuales no definidos.

## Product Principles

- Votos secretos hasta revelar, incluidos los datos enviados al navegador.
- La decisión final pertenece al moderador.
- Ingreso sencillo mediante nombre y enlace o código.
- Estado de votación y conexión claro para todo el equipo.

## Accessibility & Inclusion

Diseño adaptable, navegación por teclado, foco visible, etiquetas accesibles y contraste legible según la especificación aprobada.
