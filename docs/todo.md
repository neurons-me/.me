## Fase 3 — Cerrada (2026-04-19)

### Qué quedó validado
- chunk-aware builder: ~4.4x más rápido que el builder vector-level en 10k con `chunkRepresentativesPerChunk=8`
- cap tuning: `maxCandidateChunks` resolvió el falso techo de recall
- instrumentación: `chunks/query`, `chunks_per_centroid`, `posting_list_size_avg` ya quedan como métricas base de ANN
- benchmark `100k` en corpus `chunk_coherent` pasó el criterio de cierre con `nlist=512`, `nprobe=20`, `cap=128`

### Resultado de cierre
- exact p95: `77129.34ms`
- IVF p95: `3318.42ms`
- recall@10: `1.000`
- chunks/query: `18.40`
- speedup p95: `23.2x`

### Benchmarks oficiales
- realistic / `chunk_coherent`: `recall@10=1.000`, `chunks/query≈18.4`, `IVF p95≈3.32s`
- hostile / `legacy_fragmented`: `recall@10=1.000`, `chunks/query≈97.6`, `IVF p95≈19.35s`

### Decisión tomada
- Fase 3 queda cerrada para corpus realista/chunk-coherent
- el corpus `legacy_fragmented` se conserva como benchmark worst-case, no como número principal de portada
- no hace falta empujar `nlist=1024` para cerrar esta fase

### Lo que sigue
- actualizar README con benchmark realistic + caveat hostile
- mergear PR3
- dejar `chunk_aware + reps=8 + nlist=512` como baseline actual
