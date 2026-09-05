# LiquiVerde API (backend)

Ver el [README principal](../README.md) para la guía completa (setup con Docker, variables de entorno, algoritmos, seguridad, testing, sección "Uso de IA").

## Comandos rápidos (dev local, sin Docker)

```bash
pnpm install
pnpm start:dev          # requiere postgres+redis corriendo (docker compose up postgres redis -d desde la raíz)
pnpm test                # unit tests (49) — motores de dominio puros
pnpm test:e2e             # e2e tests (18) — requiere postgres+redis
pnpm lint
pnpm prisma:studio       # explorar la base de datos
```
