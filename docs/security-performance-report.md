# Reporte de pruebas de seguridad y rendimiento — LiquiVerde API

**Fecha:** 2026-09-04
**Entorno:** Stack Docker Compose local (`postgres:16-alpine`, `redis:7-alpine`, `api` en modo `runtime`), `BASE_URL=http://localhost:3000` (seguridad) / `http://api:3000` (carga, dentro de la red `liquiverde_liquiverde-net`).
**Alcance:** Scripts dirigidos a vectores de ataque concretos + auditoría de dependencias (sin scanner automatizado tipo OWASP ZAP, por decisión explícita) y pruebas de carga con k6 (rampas de hasta 100 VUs), con foco en `POST /lists/:id/optimize` (RNF-01) y en el rate limiting de auth.

---

## 1. Resumen ejecutivo

- **Seguridad:** 78 verificaciones ejecutadas, **78/78 pasaron**. 6 hallazgos documentados (0 críticos/altos, 2 bajos, 4 informativos) + 1 vulnerabilidad de dependencia de severidad alta (con contexto de explotabilidad baja, ver §4).
- **Rendimiento:** El motor de optimización (knapsack DP) es rápido en sí mismo — **p95 = 58 ms de tiempo de cómputo puro** incluso a 500 candidatos, cumpliendo la métrica algorítmica de RNF-01 (`<2s, 500 productos`) con amplio margen. Sin embargo, se encontró un **hallazgo severo de rendimiento (ALTO)**: bajo solo 20 usuarios virtuales concurrentes, la latencia HTTP total de `POST /lists/:id/optimize` alcanza **p95 = 19.76s**, muy por encima del umbral de 2s aplicado al endpoint completo. La causa raíz identificada es una escritura no optimizada en base de datos (detalle en §5, hallazgo F-01), no el algoritmo de optimización.
- La carga de lectura pública (`/categories`, `/products/search`, `/substitution`) se comporta correctamente hasta 50 VUs (p95 = 7.27ms), con 0% de errores reales.
- No se modificó `RATE_LIMIT_MAX` del `.env` raíz — se confirmó en 100 al cierre de las pruebas (ver §7, Verificación).

---

## 2. Resultados de seguridad

Todas las verificaciones son pass/fail automático (`test/security/*.spec.ts` + `.sh`), con salida guardada en `test/security/results/*.json`.

| # | Vector | Endpoint(s) | Checks | Resultado | Severidad de hallazgos |
|---|---|---|---|---|---|
| 1.1 | Auth / JWT tampering (sin token, malformado, firma alterada, `alg:none`, secreto ajeno, expirado, `sub` forjado) | `GET /users/me`, `POST /lists` | 9/9 | ✅ PASS | 1 bajo |
| 1.2 | IDOR / bypass de ownership | `GET/PATCH/DELETE /lists/:id`, items, `optimize`, `savings`, `substitute` | 14/14 | ✅ PASS | — |
| 1.3 | Mass assignment / over-posting | `PATCH /users/me`, `POST /auth/register`, `POST /lists`, `PATCH /lists/:id`, `POST items` | 7/7 | ✅ PASS | 2 info |
| 1.4 | Inyección SQL / comandos | `/products/search?q=`, `/auth/login`, `/health` | 10/10 | ✅ PASS | — |
| 1.5 | Validación de entrada (tipos, rangos, arrays, JSON anidado, strings largos, unicode) | `/lists`, `/lists/:id/items`, `/products/compare`, `/auth/register` | 8/8 | ✅ PASS | 1 bajo |
| 1.6-A | Rate limiting — buckets de auth | `POST /auth/register`, `POST /auth/login` | 9/9 | ✅ PASS | 1 info |
| 1.6-B | Rate limiting — bucket global | `GET /health` (110 llamadas concurrentes) | 5/5 | ✅ PASS | — |
| 1.7-1.8 | CORS + headers de seguridad | `/categories`, `/health` | 7/7 | ✅ PASS | — |
| 1.9 | Manejo de errores / fuga de información | Muestreo de 4xx en toda la suite, `/auth/login` | 6/6 | ✅ PASS | 1 info |
| 1.10 | Enumeración de usuarios | `POST /auth/register` (email duplicado) | incluido en 1.3 | ✅ PASS | 1 info |
| 1.12 | Secretos en código / `.gitignore` | `backend/src`, `.gitignore` (raíz y backend) | 3/3 | ✅ PASS | — |
| **Total** | | | **78/78** | ✅ | **2 bajos, 4 info** |

Ningún check falló (0 fallos reales de seguridad). Los "hallazgos" listados son items documentados intencionalmente (bajo o informativo), detallados en §5.

---

## 3. Resultados de rendimiento (k6)

| Escenario | VUs (rampa) | Duración | p95 | p99 | Error rate real | Threshold | Resultado |
|---|---|---|---|---|---|---|---|
| 2.1 Smoke (`/health`, `/products/search`) | 2 VUs, 10 iteraciones | ~10s | 19.75ms | — | 0% | `p95<500ms`, `failed==0` | ✅ PASS |
| 2.2 Carga de lectura (`/categories`, `/products/search`, `/substitution`) | 10→30→50 | ~5 min | 7.27ms | 12.68ms | 0.00% | `p95<400ms`, `p99<800ms`, `error<1%` | ✅ PASS |
| 2.3 `POST /optimize` bajo carga (RNF-01) | 5→20 | ~2m20s | **19.76s** | — | 0.72% | `p95<2000ms` (endpoint), `failed<5%` | ❌ **FALLÓ** el threshold de latencia |
| 2.4 Estrés exploratorio `POST /optimize` | 10→30→60→100 | 2m30s | 422ms (global, dominado por 429 rápidos)¹ | — | 97.49%² | sin threshold (exploratorio) | ⚠️ Ver nota |

¹ A partir de ~30-40 VUs el bucket global de 100 req/min queda saturado y la mayoría de las peticiones reciben un **429 casi instantáneo**, lo que "diluye" la mediana/p95 global. Filtrando solo las respuestas exitosas (`expected_response:true`, es decir 201): **avg=25.09s, mediana=25.29s, p90=46.66s, p95=47.55s, max=50.2s** — la latencia real del camino que sí llega a ejecutarse empeora con más concurrencia, consistente con la causa raíz de §5 (F-01).
² `http_req_failed` de k6 cuenta como "fallo" cualquier status ≥400, lo que aquí incluye los 429 esperados (rate limiting correcto) — no representa 97% de errores reales del backend. De 4430 requests, 4407 (99.48%) devolvieron 201 o 429 como se esperaba; **23 requests (0.51%)** devolvieron algo distinto (probablemente timeouts o conexiones agotadas bajo contención extrema) — no se capturó el status exacto de esos 23 porque esta corrida es exploratoria y no tiene assertions detalladas por status; se documenta como observación, no como hallazgo cuantificado con precisión.

**Dato clave para el diagnóstico** (extraído del campo `computeTimeMs` de cada respuesta 201 en el escenario 2.3, correlacionado con la latencia HTTP total de la misma petición):

| Métrica | Tiempo puro del motor DP (`computeTimeMs`, servidor) | Latencia HTTP total (cliente) |
|---|---|---|
| avg | 28.9 ms | 14.06 s |
| p90 | 47.1 ms | 18.78 s |
| p95 | 58.0 ms | 19.76 s |
| max | 150.2 ms | 21.73 s |

`usedFallback` se mantuvo en `false` durante toda la corrida (siempre rama DP exacta, nunca fallback greedy) — la calibración de `budgetMax=4000` para listas de 500 items fue correcta y estable.

Esta tabla es la evidencia central de que el algoritmo de optimización (RF-04, RNF-01 en su lectura algorítmica) **no es el cuello de botella** — hay una brecha de ~340x entre el tiempo de cómputo puro y la latencia observada por el cliente. Diagnóstico completo en §5, hallazgo F-01.

---

## 4. Auditoría de dependencias

`pnpm audit` sobre 814 dependencias totales (284 prod + 530 dev + 42 opcionales):

| Paquete | Versión instalada | Severidad | CVE / Advisory | Ruta | Corregido en |
|---|---|---|---|---|---|
| `deepmerge-ts` | 7.1.5 | **Alta** | GHSA-ggr8-5vv4-36mx (stack exhaustion al fusionar grafos de objetos recursivos) | `prisma > @prisma/config > deepmerge-ts` (y vía `@nestjs/terminus > @prisma/client`) | ≥8.0.0 |

**Contexto de explotabilidad:** `deepmerge-ts` es una dependencia transitiva del **CLI de Prisma** (`@prisma/config`), no del cliente de runtime (`@prisma/client` en sí no la usa para operaciones de query). Se ejecuta únicamente durante `prisma migrate`, `prisma generate` o `prisma db seed` — es decir, en tiempo de build/despliegue, nunca con input HTTP de un usuario final durante la operación normal de la API. Riesgo práctico: **bajo** en este contexto de uso, aunque la severidad reportada por el advisory sea alta. No requiere acción urgente; se puede resolver alineando la versión de `prisma`/`@prisma/config` en una futura actualización de rutina.

No se encontraron vulnerabilidades de severidad crítica, moderada, baja ni informativa adicionales.

**Nota sobre versiones fijadas deliberadamente:** varios paquetes `@nestjs/*` (`@nestjs/config@4.0.4`, `@nestjs/jwt@11.0.2`, etc.) están fijados a versiones CJS-compatibles por incompatibilidad ESM con Jest, decisión tomada durante la implementación. Se revisó que ninguna de esas versiones fijadas tenga un CVE conocido resuelto en una versión más nueva — no aplica ningún trade-off de seguridad pendiente por esta razón.

---

## 5. Detalle de hallazgos (por severidad)

### 🔴 ALTO

**F-01 — Latencia severa de `POST /lists/:id/optimize` bajo concurrencia (cuello de botella en escritura, no en el algoritmo)**

- **Endpoint:** `POST /lists/:id/optimize`
- **Evidencia:** p95 = 19.76s de latencia HTTP total a solo 20 VUs concurrentes (listas de 500 items c/u), mientras que el tiempo de cómputo puro del motor DP (`computeTimeMs`, reportado por el propio servidor) se mantuvo en p95 = 58ms — una brecha de ~340x. Empeora con más concurrencia: en la corrida exploratoria de estrés (10→100 VUs), las peticiones que sí llegan a ejecutarse (no bloqueadas por rate limit) muestran mediana=25.29s, p95=47.55s, max=50.2s.
- **Causa raíz (confirmada leyendo el código, no solo inferida por los números):** `ListsRepository.applyOptimization()` (`backend/src/modules/lists/lists.repository.ts:92-117`) ejecuta:
  ```ts
  await this.prisma.$transaction([
    ...items.map((item) =>
      this.prisma.listItem.update({
        where: { id: item.id },
        data: { includedInOptimum: selectedSet.has(item.id) },
      }),
    ),
    this.prisma.shoppingList.update({ ... }),
  ]);
  ```
  Esto genera **una llamada `UPDATE` individual por cada `ListItem`** (hasta 500 por lista) dentro de un array pasado a `$transaction([...])`. Prisma ejecuta las operaciones de un `$transaction` en forma de array **secuencialmente** (no en paralelo) dentro de una única transacción de base de datos — es decir, una sola petición de optimización ya implica ~501 round-trips secuenciales a Postgres. Bajo 20 peticiones concurrentes (cada una sobre su propia lista de 500 items), esto produce miles de UPDATE individuales compitiendo por el pool de conexiones y el motor de ejecución de Postgres simultáneamente, lo que explica el crecimiento no lineal de la latencia observada.
- **Se descartó como causa:** el algoritmo de optimización en sí (`computeTimeMs` se mantiene bajo, `usedFallback=false` todo el tiempo — la rama DP exacta funciona como se espera), problemas de índices o triggers en `ListItem` (revisado el schema: solo índices simples en `listId`, `productId`, `substitutedFromId`, sin triggers), y contención de Redis (el rate limiter usa su propio almacenamiento y no interviene en esta ruta de escritura).
- **Impacto:** bajo la lectura estricta de RNF-01 ("Rendimiento (<2s, 500 productos)", `PLAN_DE_TRABAJO.md` línea 162, referido al algoritmo), el motor cumple ampliamente. Pero el endpoint completo — la operación que un usuario real experimenta al pulsar "optimizar" — no es utilizable con más de un puñado de usuarios concurrentes activando esta acción sobre listas grandes: cualquier despliegue con tráfico concurrente real (aunque sea moderado) verá timeouts o esperas de decenas de segundos en esta funcionalidad central del producto (RF-04/RF-05).
- **Recomendación:** reemplazar el bucle de updates individuales por una operación en bloque. Dos opciones viables sin cambiar el esquema:
  1. Dos `updateMany` (uno para los items con `includedInOptimum: true`, uno para `false`), usando `where: { id: { in: [...] } }` — reduce ~500 round-trips a 2.
  2. Una sentencia `$executeRaw` con `UPDATE list_items SET included_in_optimum = (id = ANY($1)) WHERE list_id = $2` — 1 round-trip.
  Cualquiera de las dos debería llevar la latencia del endpoint a valores cercanos al tiempo de cómputo puro (decenas de ms) más el costo de 1-2 queries en bloque. **No se implementó ningún cambio de código** — este reporte es de pruebas, la remediación queda a decisión del usuario.

### 🟡 BAJO

**F-02 — `sub` forjado (pero firmado con el secreto real) produce un 500 no mapeado en `POST /lists`**
- Un JWT con firma válida (requiere poseer `JWT_SECRET`, lo cual ya es un compromiso total) pero con un `sub` de usuario inexistente causa una violación de FK de Prisma no capturada, expuesta como 500 genérico en vez de un 4xx limpio.
- Severidad baja: explotar esto ya requiere el secreto real del servidor.
- **Recomendación:** `AllExceptionsFilter` podría mapear el código Prisma `P2003` (violación de FK) igual que ya hace con `P2002`/`P2025`.

**F-03 — `RegisterDto.name` no tiene límite de longitud**
- Acepta un nombre de 100 000 caracteres (201 Created) — sin `@MaxLength` en el DTO ni restricción de longitud en la columna de Prisma.
- **Recomendación:** agregar `@MaxLength(120)` (o similar) a los campos de texto libre en los DTOs relevantes.

### ℹ️ INFORMATIVO (no son bugs, documentados para contexto de diseño)

**F-04 — Los buckets de rate limit de `/auth/register` y `/auth/login` son independientes, no compartidos**
- `@nestjs/throttler` genera la clave como `${Controller}-${Handler}-${throttlerName}-${ip}` — el nombre del handler forma parte de la clave, así que ambos endpoints tienen contadores de 5/min independientes aunque compartan el nombre de throttler `"default"`. El límite combinado efectivo de auth es 10 req/min (5+5), no 5 como sugeriría un bucket compartido.
- Para compartir un bucket real haría falta un `generateKey` personalizado en el decorador `@Throttle`.

**F-05 — `POST /auth/register` revela si un email ya existe (409)**
- Trade-off estándar de la industria (UX de registro claro vs. enumeración de bajo impacto), parcialmente mitigado por el límite de 5 req/min. Aceptado, no es una corrección pendiente.

**F-06 — Asimetría de timing en `/auth/login` entre email inexistente y password incorrecta**
- Promedio: email inexistente 5.5ms vs password incorrecta 27.5ms (6 muestras c/u) — `AuthService.login()` solo ejecuta `argon2.verify()` cuando el usuario existe. Explotabilidad muy baja en este contexto (el jitter de red normalmente supera esta diferencia).

**F-07 — Defensa en profundidad ya presente contra mass assignment**
- `UsersService.update()` y `ListsRepository.update()` construyen el objeto `data` de Prisma campo por campo con spreads condicionales, nunca `...dto` — aunque `ValidationPipe` fuera bypaseado, campos no soportados no llegarían a la base de datos. Ya implementado, no es una acción pendiente.

---

## 6. Limitaciones de alcance documentadas

Estas **no son hallazgos de seguridad o rendimiento** — son condiciones del entorno de prueba que un lector del reporte debe conocer para interpretar los resultados correctamente:

- **Rate limit compartido por IP:** todos los VUs de k6 comparten la misma IP de origen (una sola máquina), por lo que comparten el bucket global de 100 req/min. A partir de ~30-50 VUs esto genera un piso significativo de 429 "correctos" que no deben confundirse con errores del backend — se separó explícitamente en las métricas (`real_error_rate` vs `rate_limited_rate` en 2.2; check de status 201/429 en 2.3/2.4).
- **Sin límites de recursos Docker:** `docker-compose.yml` no define `deploy.resources.limits`, `mem_limit` ni `cpus` para ningún servicio. El techo de rendimiento medido (incluyendo el hallazgo F-01) corresponde a los recursos del host de desarrollo usado para estas pruebas, no a un despliegue con límites acotados tipo producción.
- **Sin scanner automatizado:** por decisión explícita, no se usó OWASP ZAP ni herramienta equivalente. La cobertura de seguridad se limita a los vectores dirigidos listados en §2 — no es un análisis exhaustivo de superficie de ataque.
- **Prueba de estrés (2.4) es exploratoria:** sin thresholds de pass/fail; su propósito es observar comportamiento en el límite, no validar un SLA. El 0.51% de checks fallidos (23/4430) bajo 100 VUs no fue diagnosticado a nivel de status code exacto por esta razón.
- **Datos de la prueba de carga sembrados fuera de banda:** las 5 listas de 500 items usadas en 2.3/2.4 se crearon escribiendo directamente vía Prisma (no a través del endpoint HTTP `POST /lists/:id/items`), para no consumir ~25 minutos del rate limit solo en preparación. Esto es una práctica estándar de setup en pruebas de carga (aislar la preparación de datos del endpoint bajo prueba) y no afecta la validez de las mediciones sobre `POST /optimize` en sí.

---

## 7. Verificación de cierre

- `RATE_LIMIT_MAX` en `.env` (raíz): **100** (valor original, sin modificar durante las pruebas) — confirmado por lectura directa del archivo al cierre.
- `RATE_LIMIT_TTL`: 60 (sin modificar).
- El contenedor `api` no requirió reinicio ni reconfiguración durante ninguna prueba.
- Todos los specs de seguridad terminan con exit code 0 (78/78 checks pasaron); los scripts k6 respetaron sus thresholds declarados, con la única falla siendo la esperada y ya documentada en 2.3 (F-01).

**Housekeeping pendiente (no ejecutado, a decisión del usuario):** las pruebas crearon ~20-25 usuarios de prueba (specs de seguridad) y 5 usuarios `k6pool-*` con listas de 500 items cada uno en la base de datos de desarrollo. No se eliminaron automáticamente — es un `docker compose down -v` (borra todo el volumen) o una limpieza selectiva vía Prisma Studio/SQL, según se prefiera, y no se ejecutó ninguna de las dos por ser una acción destructiva fuera del alcance de "pruebas".

---

## 8. Recomendaciones priorizadas

1. **[Alto impacto]** Corregir F-01: reemplazar los updates individuales de `ListsRepository.applyOptimization()` por una operación en bloque (`updateMany` x2 o `$executeRaw`). Es el único hallazgo que compromete una funcionalidad central del producto bajo uso concurrente real.
2. **[Bajo esfuerzo]** Agregar `@MaxLength` a `RegisterDto.name` y otros campos de texto libre similares (F-03).
3. **[Bajo esfuerzo]** Mapear `P2003` en `AllExceptionsFilter` para evitar 500 no controlados ante violaciones de FK (F-02).
4. **[Opcional / higiene]** Si se desea un bucket de auth verdaderamente compartido (5 req/min combinados entre register+login en vez de 10), implementar un `generateKey` personalizado en `@Throttle` (F-04) — no es una vulnerabilidad, es una decisión de diseño a confirmar con el equipo.
5. **[Cuando se actualice Prisma de rutina]** Resolver la advisory de `deepmerge-ts` alineando versiones de `prisma`/`@prisma/config` (§4) — no urgente dado el contexto de explotabilidad.
