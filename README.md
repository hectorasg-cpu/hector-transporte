# App de pedidos de transporte

## Ejecutar local

```powershell
node server.js
```

Local: http://127.0.0.1:4174/

## Publicar en Railway

1. Sube esta carpeta a un repositorio de GitHub.
2. En Railway, crea un proyecto nuevo y elige Deploy from GitHub repo.
3. Selecciona el repositorio. Railway usara `railway.json` y ejecutara `node server.js`.
4. En el servicio, abre Settings > Networking y genera un dominio publico.
5. Agrega un Volume al servicio.
6. Monta el Volume en `/app/data` o usa el mount path que Railway entregue en `RAILWAY_VOLUME_MOUNT_PATH`.
7. Reinicia/redeploya el servicio.

Los datos se guardan en `state.json` dentro del volumen en Railway. Localmente se guardan en `data/state.json`.


## Si Railway falla al construir

Este proyecto incluye un `Dockerfile`, asi que Railway puede construirlo sin adivinar el entorno. Sube tambien `Dockerfile`, `.dockerignore`, `package.json`, `server.js`, `railway.json`, `outputs/` y `data/`.
