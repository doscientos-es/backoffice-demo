# Doscientos Backoffice · Demo local

Copia del backoffice real preparada para demostraciones públicas.

## Aislamiento

- Acceso automático con un usuario ficticio; no existe login.
- Los datos de la demo viven en `data/demo-data.json`; no hay BBDD ni SDK de Supabase.
- No lee archivos `.env` ni necesita variables de entorno.
- Todas las rutas y pantallas se conservan. Las acciones e integraciones responden con datos mock.
- Un guard de navegador y otro de servidor devuelven respuestas locales a cualquier `fetch`; no se abre ninguna conexión de red.
- No incluye certificados, migraciones, documentación interna ni datos reales.

## Uso

Ejecuta `pnpm install` y después `pnpm dev`. La demo se abre en `http://localhost:3000`.

Los datos se reinician al reiniciar el proceso. Las mutaciones son simuladas y nunca salen del equipo. suap