# Motorcito — Sistema vivo de predicción del Mundial 2026

Aplicación web que genera predicciones del Mundial, **consolida el pronóstico de
varios modelos**, agrega una predicción tipo **Gemini**, consume una **API de
resultados** y **actualiza automáticamente** el estado del torneo (clasificación,
llaves y métricas) conforme se publican nuevos marcadores.

No es un generador aislado de pronósticos: mantiene consistencia entre **datos
fuente → predicción de mercado → consenso del sistema → resultado real → versión**.

> Base funcional pensada para que otro desarrollador la extienda. Las
> *decisiones abiertas* del documento están cerradas con valores por defecto
> razonables y claramente marcadas para sustituir.

---

## Arranque rápido

```bash
npm install
npm test     # 24 verificaciones de los criterios de aceptación
npm start    # http://localhost:3000  (dashboard + API)
npm run dev  # con recarga en caliente
```

Variables de entorno opcionales:

| Variable | Default | Uso |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `RESULTS_API_URL` | — | Si se define, usa la API de resultados externa en vez del fixture local |
| `RESULTS_API_KEY` | — | Bearer token para la API de resultados |
| `GEMINI_API_KEY` | — | Si se define, `/run` usa Gemini real; si no, baseline Elo local |
| `SYNC_INTERVAL_SECONDS` | `0` | Polling automático de resultados (0 = desactivado) |
| `MOTORCITO_STATE_DIR` | `.motorcito-data` | Carpeta de estado mutable (resultados, versiones, auditoría) |

---

## Arquitectura (5 capas)

```
Ingesta → Normalización → Motor predictivo → Sincronización → Presentación
```

| Módulo (spec) | Archivo | Responsabilidad |
|---|---|---|
| Tournament Loader | `src/modules/tournamentLoader.ts` | Fixture canónico de 104 partidos (grupos + plantilla de llaves) |
| Team Resolver | `src/modules/teamResolver.ts` | Unifica nombre EN/ES y código FIFA (clave canónica) |
| Feature Builder | `src/modules/featureBuilder.ts` + `elo.ts` | Elo, ranking FIFA y forma → matriz de variables |
| Prediction Aggregator | `src/modules/predictionAggregator.ts` | Consenso ponderado (soft-voting) de modelos + Gemini |
| Bracket Engine | `src/modules/bracketEngine.ts` | Tablas de grupo con desempates, mejores terceros y arrastre de la llave |
| Results Sync | `src/modules/resultsSync.ts` + `resultsProvider.ts` | Consulta la API, detecta cambios, recalcula en cascada (idempotente) |
| Model Scorer | `src/modules/modelScorer.ts` | Accuracy, Brier, exactos, bracket points → leaderboard |
| Audit Log + Versionado | `src/data/store.ts` | Qué cambió, cuándo, por qué + hash de versión reconstruible |
| Gemini / Batch | `src/modules/gemini.ts` + `batchPredictor.ts` | Nueva corrida (Gemini real o baseline Elo local) |
| Projection | `src/modules/projection.ts` | Escenario proyectado (oficial + relleno Elo) para UI |

El **motor predictivo** opera en 3 niveles:
1. **Crudo** por modelo (los 10 archivos del benchmark, validados por esquema).
2. **Consenso** por partido = promedio ponderado de las probabilidades 1X2.
3. **Recalibración**: los resultados reales actualizan el Elo dinámico y los
   pesos del ensemble (peso ∝ accuracy observada).

Cada partido distingue las tres señales que pide la spec: **mercado** (Elo),
**consenso** (modelos + Gemini) y **resultado real** (API).

---

## API interna

| Endpoint | Método | Función |
|---|---|---|
| `/api/tournament` | GET | Torneo, metadatos y versión actual |
| `/api/groups` | GET | Tablas de grupo oficiales + criterios de desempate |
| `/api/groups/projected` | GET | Clasificación viva (oficial + proyección) |
| `/api/matches` · `/api/matches/{id}` | GET | Listado / detalle con mercado, consenso, por-modelo y resultado |
| `/api/predictions/ensemble` | GET | Consenso final (partidos + campeón) y pesos |
| `/api/predictions/import` | POST | Importa una predicción lista (valida esquema) |
| `/api/models` | GET | Modelos + métricas (leaderboard) + validación |
| `/api/models/{id}/run` | POST | Ejecuta nueva predicción (Gemini o batch local) |
| `/api/results/sync` | POST | Sincroniza resultados reales (solo backend) |
| `/api/bracket` | GET | Llave completa (oficial + escenario proyectado) |
| `/api/audit` · `/api/versions/{hash}` | GET | Trazabilidad y snapshots reconstruibles |
| `/api/export?format=json\|csv&what=matches\|leaderboard` | GET | Exporta estado |

---

## Contrato de entrada (`data/`)

Los archivos se tratan como **contrato**, no como datos auxiliares. Toda
predicción se valida contra `predictions_schema.json` (draft-07, vía `ajv`)
**antes** de guardarse o publicarse: probabilidades 1X2 que suman 1.0 ±0.02,
72 partidos de grupo, 16/8/4/2 de eliminación, códigos FIFA de 3 letras, etc.

- `worldcup.json` — 104 partidos (fixture + plantilla oficial de llaves con slots `2A`, `3A/B/C/D/F`, `W74`…).
- `worldcup.groups.json` / `worldcup.teams.json` — 12 grupos, 48 selecciones.
- `predictions/*.json` — 10 modelos del benchmark.
- `elo_ratings.json` — Elo por código FIFA (derivado de `teams.ts`).
- `leaderboard.json`, `fifa_mens_rank.csv`, `resultados_*.csv` — features y baseline.

---

## Decisiones abiertas (cerradas aquí)

| Decisión | Valor por defecto | Dónde cambiarlo |
|---|---|---|
| Fuente de la API de resultados | Fixture local (`worldcup.json`) | `RESULTS_API_URL` → `ExternalHttpProvider` |
| Método de ensemble | Soft-voting ponderado por accuracy | `predictionAggregator.ts` |
| Polling vs webhooks | Polling configurable (`SYNC_INTERVAL_SECONDS`) | `server/index.ts` |
| Backend / almacenamiento | Node + Express + ficheros JSON versionados | `data/store.ts` (swappable a BD) |
| Recalibración de pesos | Peso = 0.25 + accuracy | `modelScorer.ts → performanceWeights()` |

---

## Garantías no funcionales

- **Idempotencia**: re-sincronizar sin novedades no genera cambios ni versiones.
- **Validación estricta** de esquemas de entrada (no se persiste nada inválido).
- **Trazabilidad completa**: cada cambio deja auditoría + hash de versión.
- **Reconstrucción** de cualquier estado anterior vía `/api/versions/{hash}`.
- **Errores visibles**, sin silencios.


## Informe independiente

El informe sobre fatiga de decisión y TDAH se conserva en [Fatiga-Decision-TDAH-Inatento-Informe-Consolidado.md](Fatiga-Decision-TDAH-Inatento-Informe-Consolidado.md). Su documentación original está en [docs/fatiga_decision/README.md](docs/fatiga_decision/README.md). Ambos proyectos continúan en `main`.
