# LiquiVerde — Backend y Base de Datos

Plataforma de retail inteligente para ahorro y consumo sostenible. Este documento cubre el **backend** (API REST NestJS + PostgreSQL + Redis, dockerizado). El frontend Angular tiene su propia documentación en [`../frontend/README.md`](../frontend/README.md).

Diseño derivado de [`../LiquiVerde_Documento_Tecnico.pdf`](../LiquiVerde_Documento_Tecnico.pdf) y [`../PLAN_DE_TRABAJO.md`](../PLAN_DE_TRABAJO.md) (raíz del repo) y del plan de implementación ejecutado en esta sesión.

---

## 1. Stack

| Componente | Tecnología |
|---|---|
| Backend | NestJS 11 (TypeScript), arquitectura modular por dominio |
| ORM | Prisma 6 (`prisma-client-js`) |
| Base de datos | PostgreSQL 16 |
| Caché / degradación | Redis 7 |
| Auth | JWT (`@nestjs/jwt` + `passport-jwt`), hashing `argon2id` |
| Docs API | Swagger / OpenAPI (`/api/docs`) |
| Contenerización | Docker multi-stage + Docker Compose |
| Fuentes externas | Open Food Facts (sin key), USDA FoodData Central (opcional, requiere key), OpenStreetMap Nominatim |

---

## 2. Setup — `docker compose up`

Requisitos en el host: **Docker Desktop** (o Docker Engine + Compose v2) únicamente. No se necesita Node/pnpm instalado localmente para levantar el stack.

```bash
# desde la raíz del repo (Prueba Tecnica/)
cp .env.example .env      # ajustar JWT_SECRET al menos (ver sección 3)
docker compose up --build
```

Esto levanta, en orden, con healthchecks reales entre pasos:

1. `postgres` (16-alpine) — volumen persistente `pgdata`.
2. `redis` (7-alpine) — volumen persistente `redis-data`.
3. `migrate` — job de un solo uso: aplica migraciones Prisma (`prisma migrate deploy`) y siembra el catálogo sintético (`prisma db seed`), luego termina. Es **idempotente**: correr `docker compose up` de nuevo no duplica datos.
4. `api` — arranca solo después de que `migrate` termina exitosamente. Expone `http://localhost:3000`.

Verificación rápida:

```bash
curl http://localhost:3000/health          # {"status":"ok", ...}
open http://localhost:3000/api/docs        # Swagger UI
```

Para bajar todo (conservando datos): `docker compose down`. Para partir de cero: `docker compose down -v`.

### Desarrollo local sin Docker (opcional)

```bash
cd backend
pnpm install
docker compose up postgres redis -d   # solo la infra, desde la raíz
cp .env.example .env                  # backend/.env.example, apunta a localhost
pnpm prisma migrate dev
pnpm prisma db seed
pnpm start:dev
```

### Comandos rápidos

```bash
pnpm start:dev           # requiere postgres+redis corriendo (docker compose up postgres redis -d desde la raíz)
pnpm test                # unit tests (49) — motores de dominio puros
pnpm test:e2e            # e2e tests (18) — requiere postgres+redis
pnpm lint
pnpm prisma:studio       # explorar la base de datos
```

---

## 3. Variables de entorno

Documentadas en `../.env.example` (raíz del repo, para Docker Compose) y `.env.example` (este directorio, para correr fuera de Docker). Resumen:

| Variable | Propósito |
|---|---|
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Firma de tokens (RNF-05). **Cambiar el valor por defecto antes de cualquier uso real.** |
| `POSTGRES_USER/PASSWORD/DB` | Credenciales de Postgres (solo Docker Compose las usa para construir `DATABASE_URL`) |
| `OPENFOODFACTS_BASE_URL` | Siempre activo, no requiere key |
| `USDA_API_KEY` | **Opcional.** Si se deja vacío, la integración USDA simplemente no participa en las búsquedas — el sistema funciona completo solo con Open Food Facts. Si se define, se activa automáticamente (`ProductsModule`, factory condicional). |
| `NOMINATIM_BASE_URL` / `NOMINATIM_USER_AGENT` | Geocodificación de tiendas (RF-09, bonus) |
| `CORS_ORIGIN` | Origen permitido (frontend) |
| `SCORING_WEIGHT_*` | Pesos del scoring de sostenibilidad (RF-03) — deben sumar 1 |
| `KNAPSACK_WEIGHT_*` + `KNAPSACK_DISCRETIZATION_*` | Pesos y parámetros del optimizador (RF-04) |
| `SUBSTITUTION_*` | Umbral de precio y pesos del motor de sustitución (RF-06) |
| `RATE_LIMIT_TTL` / `RATE_LIMIT_MAX` | Rate limiting global (RNF-05) |

La app **falla al arrancar** (fail-fast) si falta una variable requerida o si los pesos no suman ~1 — ver `src/config/env.validation.ts`.

---

## 4. Dataset sintético (RF-13)

`prisma/seed.ts` genera programáticamente **~65-75 productos** (varía levemente por aleatoriedad determinística) en 16 categorías-hoja, con precio, marca, huella de carbono estimada, origen, certificaciones y packaging — usando una RNG con seed fija (reproducible) y códigos de barra EAN-13 válidos.

**Los datos son sintéticos, no reales.** Precios, huellas de carbono y orígenes fueron generados con rangos informados por patrones generales conocidos (ej. cárnicos > lácteos > procesados > vegetales frescos en huella de carbono), no medidos. Esto reemplaza a Tesco API / Carbon Interface, que no son de acceso público gratuito — ver justificación en el documento técnico, sección 6.

El seed **reutiliza el mismo motor de scoring** (`src/modules/sustainability/domain/scoring.engine.ts`) que usa la app en producción, así que no hay drift entre el dataset de ejemplo y el algoritmo real.

---

## 5. Algoritmos core

### 5.1 Mochila multi-objetivo (RF-04) — `src/modules/lists/domain/knapsack.engine.ts`

Knapsack 0/1 con presupuesto como restricción de peso. Valor de cada candidato:

```
valor(i) = w1·utilidad(i) + w2·sostenibilidad(i) + w3·ahorroRelativo(i)
```

- **Implementación**: programación dinámica con presupuesto discretizado a centavos, con *step* adaptativo (se duplica hasta un máximo si la tabla DP excedería el límite de memoria configurado) para cumplir RNF-01 (<2s hasta 500 candidatos). Si el catálogo excede los límites configurados, cae a un *fallback* greedy por razón valor/precio.
- **Utilidad**: cada ítem agregado a la lista acepta una `priority` opcional (1-5, default 3) que se normaliza a 0-100 (`priority * 20`) — interpretación adoptada del término "utilidad", que el documento original deja abierto.
- **Ahorro estimado (RF-05)**: `Σ(precioPromedioCategoría − precioReal)` sobre los ítems seleccionados.
- Verificado con: comparación contra fuerza bruta para *n* pequeño, y una prueba de carga con 500 candidatos sintéticos (`knapsack.engine.spec.ts`) muy por debajo de 2s.

### 5.2 Scoring de sostenibilidad (RF-03) — `src/modules/sustainability/domain/scoring.engine.ts`

El promedio de la categoría es el score neutro (50); mejor que el promedio sube, peor baja. `finalScore = 0.4·económico + 0.35·ambiental + 0.25·social` (pesos configurables). **Nunca se inventa un dato faltante** (RNF-10): cuando falta información se usa el valor neutro y se registra explícitamente en `missingFields`; `dataConfidence` (HIGH/MEDIUM/LOW) refleja cuántos campos faltaron.

### 5.3 Sustitución inteligente (RF-06) — `src/modules/substitution/domain/substitution.engine.ts`

Busca candidatos en la misma categoría o categoría padre con mejor `finalScore` y precio ≤ precio original × (1 + X%). Rankea por una función compuesta: mejora de score − delta de precio + similaridad de coseno sobre atributos normalizados (precio, carbono, sub-scores). Al aceptar una sustitución se crea un nuevo `ListItem` trazado vía `substitutedFromId` (no se borra el original), lo que además alimenta el sistema de recompensas.

### 5.4 Algoritmos bonus

- **Rutas (RF-09)** — `src/modules/routes/domain/tsp.engine.ts`: TSP aproximado (vecino más cercano + mejora 2-opt) sobre un camino abierto (no vuelve al origen).
- **Planificación temporal (RF-10)** — `src/modules/planning/domain/frequency.estimator.ts`: estima intervalo promedio entre compras por producto y sugiere la próxima fecha.
- **Recompensas (RF-11)** — `src/modules/rewards/domain/rewards.calculator.ts`: puntos proporcionales a cuánto supera un ítem el umbral de score, o a la mejora de score de una sustitución aceptada.

Todos los motores anteriores son **funciones puras** (`domain/*.ts`, sin imports de `@nestjs/*` ni `@prisma/client`) — testeables sin infraestructura, siguiendo la separación por capas exigida (RNF-06).

---

## 6. API

Documentación completa e interactiva en Swagger: **`http://localhost:3000/api/docs`** (incluye autenticación Bearer para probar endpoints protegidos).

Flujo típico: `POST /auth/register` → `POST /lists` → `POST /lists/:id/items` (repetir) → `POST /lists/:id/optimize` → `GET /lists/:id/savings`. Ver también `GET /products/search`, `GET /products/barcode/:code`, `GET /substitution/:productId`, `GET /dashboard`.

---

## 7. Seguridad (RNF-05)

- JWT sin sesión de servidor (stateless — RNF-03), `Authorization: Bearer`, guard global secure-by-default (`@Public()` marca las excepciones).
- Contraseñas con `argon2id`.
- Rate limiting global (100 req/min) + límite estricto en `/auth/register` y `/auth/login` (5 req/min, ver nota en la sección de tests).
- `helmet`, CORS con allowlist explícita, validación estricta de entrada (`class-validator`, `whitelist: true, forbidNonWhitelisted: true`).
- Secretos solo vía `.env` (nunca en el código; `.gitignore` los excluye).
- Filtro global de excepciones con formato de error consistente y logging estructurado (`nestjs-pino`), sin filtrar stacks al cliente.
- **`trust proxy` configurado** (`src/main.ts`, `app.getHttpAdapter().getInstance().set('trust proxy', 1)`): detrás de un reverse proxy real (Render), Express confía en exactamente un hop para resolver `req.ip` — sin esto, el rate limiter (que usa `req.ip` como key) trataría a todos los usuarios como una sola IP compartida. Se usa `1`, nunca `true`/`'*'`, para no confiar en un `X-Forwarded-For` arbitrario enviado por el cliente.
- **Row Level Security (RLS) activo en Postgres** (Supabase): las 10 tablas de `public` tienen RLS habilitado sin policies (migración `prisma/migrations/20260905073138_enable_rls`). La app se conecta como el rol `postgres` de Supabase, que tiene `BYPASSRLS` — RLS no le afecta en nada a las queries de Prisma. Lo que sí cierra es la API REST automática que Supabase expone para cada tabla (PostgREST, accesible con la `anon key` del proyecto), un camino de acceso completamente aparte de esta API y sus guards — con RLS sin policies, ese acceso queda denegado por defecto.

---

## 8. Testing

```bash
cd backend
pnpm test        # 49 tests unitarios — los 6 motores de dominio como funciones puras
pnpm test:e2e    # 18 tests e2e — requiere postgres+redis corriendo (docker compose up postgres redis -d)
```

Los e2e cubren: registro/login/rutas protegidas, degradación ante falla de Open Food Facts (mockeada con `nock`, RNF-02), flujo completo de lista→optimización dentro de presupuesto, guard de ownership, y sustitución. El test de `auth.e2e-spec.ts` está diseñado deliberadamente para no exceder el límite de 5 req/min de los endpoints de auth (comparten el mismo *bucket* de throttling).

---

## 9. Pruebas de seguridad y rendimiento

Además de los tests funcionales (sección 8), se ejecutó una ronda dedicada de pruebas de seguridad (scripts dirigidos, no un scanner automatizado) y de rendimiento (carga real con k6) contra el stack corriendo en Docker. Reporte completo, con severidad y reproducción de cada hallazgo: **[`docs/security-performance-report.md`](docs/security-performance-report.md)**.

**Seguridad** — 78 verificaciones, **78/78 en verde**: JWT/tampering (token alterado, `alg:none`, secreto ajeno, expirado, `sub` forjado), IDOR sobre `/lists/*` (bypass de ownership entre usuarios), mass assignment (`whitelist`/`forbidNonWhitelisted`), inyección SQL, validación de entrada (tipos, rangos, arrays, JSON anidado), rate limiting (buckets de auth y global), CORS/headers (Helmet), fuga de información en errores, y auditoría de dependencias (`pnpm audit`). 6 hallazgos documentados (2 bajos, 4 informativos, 0 críticos/altos) — entre ellos: `RegisterDto.name` sin `@MaxLength`, y un 500 no mapeado ante un JWT forjado pero válidamente firmado (ya requiere poseer `JWT_SECRET`, riesgo bajo). 1 CVE alto en `deepmerge-ts` (dependencia transitiva de la CLI de Prisma, solo se ejecuta en build/migrate-time, no en runtime con input de usuario).

**Rendimiento** — carga de lectura pública (`/categories`, `/products/search`, `/substitution`) estable hasta 50 VUs (p95 = 7.27ms, 0% error real). **Hallazgo abierto, aún sin corregir**: `POST /lists/:id/optimize` bajo concurrencia — el motor de optimización en sí es rápido (p95 = 58ms de cómputo puro, medido vía `computeTimeMs`), pero la latencia HTTP total escala mal (p95 = 19.76s con solo 20 VUs concurrentes). Causa raíz identificada en `ListsRepository.applyOptimization()` (`src/modules/lists/lists.repository.ts`): un `update()` de Prisma individual por cada `ListItem` de la lista (hasta 500) dentro de un mismo `$transaction`, en vez de una operación en bloque (`updateMany` o `$executeRaw`). Queda documentado como la recomendación de mayor prioridad del reporte — no se aplicó el fix, este trabajo fue de pruebas, no de remediación.

También se armó una **colección de Postman** (30 requests, uno por endpoint, con `pm.test` y variables encadenadas — registro→token→lista→optimizar→etc. corre de punta a punta vía Collection Runner) como herramienta de QA manual/regresión complementaria a los tests automatizados; vive en el workspace de Postman del autor, no en el repo.

---

## 10. Despliegue (Render + Supabase + Redis Cloud)

El backend puede desplegarse fuera de Docker Compose apuntando `DATABASE_URL`/`REDIS_URL` a servicios administrados (Supabase para Postgres, Redis Cloud u otro proveedor para Redis). Ajustes necesarios para que funcione en una PaaS como Render, ya aplicados:

- **`docker-entrypoint.sh`** (nuevo, `ENTRYPOINT` del `Dockerfile`): corre `prisma migrate deploy && prisma db seed` antes de arrancar la app, con `exec` al final para que `node` quede como PID 1 (necesario para que las señales de shutdown lleguen bien). Reemplaza, dentro de la propia imagen, lo que localmente hace el servicio `migrate` de `docker-compose.yml` — Render no tiene un equivalente gratuito de ese contenedor de un solo uso. Es **idempotente**: `migrate deploy` no reaplica migraciones ya corridas y `prisma/seed.ts` es 100% upsert, así que correr esto en cada arranque/redeploy es seguro (verificado con una build real contra Postgres/Redis local antes de aplicarlo).
- **`src/main.ts`**: `app.enableShutdownHooks()` (para que `SIGTERM` dispare los `onModuleDestroy` de Prisma/Redis en vez de un kill duro), `trust proxy` (ver sección 7), `crossOriginResourcePolicy: 'cross-origin'` en Helmet (su default, `same-origin`, bloquearía a un frontend en otro origen aunque CORS esté bien configurado), y un middleware que colapsa `//` repetidos en el path — un cliente cuya base URL termina en `/` (típico en configuración de frontend) genera rutas como `//auth/login`, que Express trata como una ruta distinta y no encontrada (404), en vez de simplemente normalizarla.
- **RLS en Supabase** (ver sección 7) — aplicado directamente contra la base de datos real vía la misma migración de Prisma.

**Checklist al desplegar en Render** (dashboard, no requiere código):
1. **Health Check Path → `/health`** (no dejarlo en `/`, que no existe — la app solo expone esa ruta de salud, y Render marca el deploy como no saludable si el healthcheck le pega a la raíz).
2. Variables obligatorias: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `OPENFOODFACTS_BASE_URL`, `NOMINATIM_BASE_URL`. Recomendadas explícitas: `NODE_ENV=production`, `CORS_ORIGIN` (apuntar al origen real del frontend desplegado, no al default de `localhost:4200`).
3. Si `DATABASE_URL` apunta al pooler de Supabase, agregar `?sslmode=require` como endurecimiento opcional (ya funciona sin esto en modo sesión/puerto 5432, no es bloqueante).

---

## 11. Arquitectura y decisiones de diseño

- **Capas**: Presentación (controllers) → Servicios (I/O, Prisma/Redis/HTTP) → Dominio (`domain/`, funciones puras) → Prisma → Postgres. Verificable con `grep -rln "^import.*@nestjs\|^import.*@prisma/client" src/modules/*/domain/*.ts` (debe devolver vacío — ojo con un `grep` más simple: los propios comentarios de este archivo mencionan "@nestjs/@prisma/client" como documentación de la regla, así que un grep sin anclar a `^import` da falsos positivos).
- **Sin monorepo**: `backend/` y `frontend/` son proyectos independientes por decisión explícita — cada uno con su propio gestor de paquetes, sin `pnpm-workspace.yaml` compartido.
- **Sin refresh tokens**: alcance deliberado para esta prueba (access token de 2h es suficiente para un flujo de 3 pantallas); extensión simple de agregar si se necesitara.
- **Sin contenedor `worker` separado**: ningún RF exige sincronización periódica de catálogo; el recálculo de score es síncrono y barato. Se documenta como sobre-ingeniería evitable para este alcance.
- **`SustainabilityScore`**: histórico (1:N, alimenta tendencias del dashboard) + caché desnormalizada en `Product` (lectura O(1) para el optimizador).

---

## 12. Uso de IA

Este backend fue diseñado e implementado con **Claude Code** (Claude Sonnet 5, Anthropic) como agente de desarrollo, en una sesión interactiva guiada por el autor. El proceso, de forma resumida:

1. **Lectura y validación del contexto**: el agente leyó `LiquiVerde_Documento_Tecnico.pdf` y `PLAN_DE_TRABAJO.md`, exploró el estado real del repo (proyecto NestJS recién scaffoldeado, sin Prisma) y preguntó explícitamente antes de asumir decisiones no especificadas (estructura de monorepo, alcance de Docker, disponibilidad de `USDA_API_KEY`, origen del dataset) en vez de inventarlas.
2. **Plan de implementación**: se generó un plan detallado (schema Prisma completo, diseño de cada módulo, pseudocódigo de los 3 algoritmos obligatorios, seguridad, Docker, roadmap por fases) revisado y aprobado antes de escribir código.
3. **Implementación**: todo el código de `backend/` (schema, ~40 archivos TypeScript de módulos/servicios/DTOs, los 6 motores de dominio puros con sus tests unitarios, `Dockerfile`, `docker-compose.yml`, script de seed) fue escrito por el agente siguiendo ese plan.
4. **Depuración activa**: el agente detectó y corrigió por su cuenta varios problemas reales durante la construcción — un desajuste de versiones de Prisma 7 (revertido a Prisma 6 estable), varios paquetes satélite de NestJS (`@nestjs/config`, `@nestjs/jwt`, `@nestjs/passport`, `@nestjs/terminus`, `@nestjs/axios`) publicados como ESM-only e incompatibles con Jest (downgrade a las últimas versiones CJS compatibles con Nest 11), el nuevo mecanismo de aprobación de scripts de build de pnpm 10+ (bloqueaba `argon2`/`@prisma/*` en una imagen Docker limpia), un layout de compilación incorrecto (`dist/main.js` vs `dist/src/main.js`) causado por incluir `prisma/` en el build de TypeScript, y una interacción entre el rate-limiter y los tests e2e.
5. **Verificación end-to-end real**: no se asumió que el código "debería funcionar" — se levantó el stack completo con `docker compose up`, se corrieron los 49 tests unitarios y 18 e2e, y se probaron manualmente vía `curl` los flujos reales (registro, login, búsqueda, **lookup real contra Open Food Facts en vivo**, creación de lista, optimización con verificación de presupuesto, sustitución, degradación ante fallo simulado de red) antes de dar por completo cualquier parte del trabajo.

El autor definió el alcance, tomó las decisiones de producto (respondidas vía preguntas del agente) y revisó el resultado; el agente ejecutó el diseño técnico detallado, la escritura de código y la depuración de principio a fin.

Una segunda sesión, ya con el backend funcionando end-to-end, extendió este trabajo con lo descrito en las secciones 9-10: pruebas de seguridad y rendimiento contra el stack real (78 verificaciones + carga con k6, con un hallazgo de rendimiento real encontrado y documentado, no oculto), preparación del backend para desplegarse en Render contra Supabase/Redis Cloud (con cada cambio probado localmente con una build de Docker real antes de darlo por hecho, no solo revisado por lectura), y la activación de Row Level Security en Supabase — en todos los casos, verificando el comportamiento real (ejecutando código, corriendo builds, consultando la base de datos) en vez de asumirlo.
