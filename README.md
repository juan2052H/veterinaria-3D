# VetAnatomía 3D — Laboratorio virtual de anatomía veterinaria

Plataforma educativa para estudiar anatomía animal con modelos tridimensionales: explorar
por sistemas y capas, consultar fichas anatómicas, estudiar de forma guiada y evaluarse
con cuestionarios, incluida la identificación de estructuras directamente sobre el modelo 3D.

Primera especie: **perro** (*Canis lupus familiaris*). La arquitectura admite nuevas especies
sin modificar el visor ni las páginas.

> **Demo en vivo:** https://juanromanbedoya.github.io/veterinaria-3D/ (entra como invitado o regístrate; los datos se guardan en tu navegador).

> **Aviso sobre el modelo 3D.** El modelo actual (v2.2) se genera por código a partir de la
> bibliografía: modelado orgánico con campos de distancia (SDF), materiales por tejido y unas
> 205 mallas (~2,7 millones de triángulos). Tiene la topografía general correcta, pero **no** es
> un modelo anatómico validado (no proviene de un espécimen ni de tomografía), y la aplicación
> lo indica en el visor. El sistema está preparado para importar el modelo GLB definitivo: ver
> [docs/MODELOS_3D.md](docs/MODELOS_3D.md).

## Puesta en marcha

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 18 pruebas: modelo ↔ fichas, SDF, motor de cuestionarios, calificación
npm run build      # compilación de producción en dist/
```

El primer usuario que se registra en un navegador obtiene el rol de **administrador**
(panel de contenidos). También se puede entrar como invitado.

## Funcionalidades

| Área | Contenido |
|---|---|
| **Explorador 3D** | Rotación, zoom y desplazamiento; vistas lateral D/I, dorsal, ventral, craneal y caudal; centrar y restablecer; selección por clic con resaltado y etiquetas; 12 sistemas activables con opacidad propia; disección en 8 pasos (piel, fascia, músculos superficiales y profundos, vísceras, esqueleto); modo transparente, rayos X y aislamiento; comparación de lados izquierdo/derecho; comparación de capas; cortes sagital, transversal y dorsal; macho/hembra; capturas; modo sin distracciones; buscador |
| **Fichas** | Más de 120 estructuras con nombre NAV, nombre anatómico y común, sistema, clasificación, localización, función, características, relaciones, importancia clínica y referencias; comparación entre estructuras |
| **Aprendizaje** | Estudio guiado en 11 pasos, fichas de estudio (tarjetas), glosario de 49 términos, material de repaso según tus errores, filtros por nivel |
| **Cuestionarios** | Selección múltiple, verdadero/falso, identificación en 3D, relacionar, completar; aleatorios, por sistema, personalizados y guardables; modo práctica y examen con tiempo |
| **Resultados** | Nota (0–5), % de conocimiento, correctas/incorrectas, tiempo, temas dominados y a reforzar, explicación de errores, repetir o generar nueva versión, exportación a PDF |
| **Progreso** | Estructuras consultadas, sistemas estudiados, tiempo de estudio, historial, estadísticas por sistema, logros y objetivos, favoritos y marcadores |
| **Administración** | Crear preguntas, revisar y corregir fichas, importar un GLB y asociar mallas con fichas (exporta el mapa en JSON) |

## Arquitectura

```
src/
├─ core/            Tipos del dominio, 12 sistemas, bibliografía, registro de especies
├─ species/
│  └─ dog/          Todo lo específico del perro (un "manifiesto" de especie)
│     ├─ structures.ts     fichas anatómicas
│     ├─ questions.ts      preguntas redactadas
│     ├─ glossary.ts       glosario
│     ├─ guidedPath.ts     ruta de estudio guiado
│     ├─ schematicModel.ts modelo procedural v2 (se genera en un Web Worker y se cachea en IndexedDB)
│     ├─ sdf.ts / model/  modelado orgánico con SDF: esqueleto, músculos, vísceras, piel
│     ├─ meshMap.ts        asociación malla GLB → ficha
│     └─ index.ts          SpeciesManifest
├─ viewer/          Visor 3D (React Three Fiber) independiente de la especie
│  ├─ AnatomyViewer.tsx    canvas, carga de modelos, estado visual por malla, cámara, etiquetas
│  ├─ meshResolver.ts      nombre de malla → ficha (convención o meshMap)
│  ├─ viewerStore.ts       estado: sistemas, capas, cortes, selección, modo evaluación
│  └─ SystemPanel / StructurePanel / ViewerToolbar
├─ quiz/            Motor de cuestionarios (lógica pura y probada) y constructor
├─ store/           Estado global (zustand): sesión, progreso, ajustes, contenido
├─ services/        Persistencia, criptografía de contraseñas, exportación PDF
├─ lib/             Logros, progreso global, temporizador de estudio
├─ components/      Layout, componentes de interfaz, ficha reutilizable
└─ pages/           Las 10 pantallas principales + glosario, comparación, administración
```

**Decisiones clave**

- **El visor no conoce al perro.** Recibe un `THREE.Group` (generado o cargado de un GLB),
  anota cada malla con su ficha y aplica el estado visual malla a malla. Por eso el modelo
  provisional y el definitivo se comportan igual.
- **Contrato malla ↔ ficha** por convención de nombres (`femur__l`) o mapa explícito; una
  prueba automática exige que cada ficha tenga malla y viceversa.
- **El motor de cuestionarios es lógica pura**: se prueba con Vitest y podrá ejecutarse
  en el servidor para validar resultados.
- **Persistencia aislada** en `services/storage.ts` y en los stores: hoy `localStorage`,
  mañana la API Node.js + PostgreSQL ([server/](server/)) sin tocar componentes.
- **Rendimiento**: carga diferida de páginas; Three.js, R3F y jsPDF en fragmentos separados;
  el modelo se genera una vez y se cachea; los shaders solo se recompilan cuando cambia
  la transparencia o el corte.

## Añadir una especie

1. Crear `src/species/<id>/` con `structures.ts`, `questions.ts`, `glossary.ts`,
   `guidedPath.ts` y un `index.ts` que exporte un `SpeciesManifest`.
2. Declarar sus modelos en `models` (GLB recomendado).
3. Sustituir el marcador correspondiente en `src/core/registry.ts` por el manifiesto.
4. Añadir una prueba como `src/species/dog/model.test.ts` para verificar la cobertura.

Los sistemas anatómicos son comunes a todas las especies (`src/core/systems.ts`); las aves
pueden necesitar estructuras propias (p. ej. sacos aéreos) que simplemente se añaden como
fichas del sistema respiratorio.

## Documentación

- [docs/MODELOS_3D.md](docs/MODELOS_3D.md) — requisitos e importación de modelos GLB
- [docs/VALIDACION.md](docs/VALIDACION.md) — fuentes y procedimiento de revisión docente
- [server/README.md](server/README.md) y [server/schema.sql](server/schema.sql) — backend previsto

## Siguientes pasos recomendados

1. **Modelo anatómico definitivo** (prioridad principal): obtener o encargar un GLB con
   licencia adecuada y validarlo; importarlo con el panel de administración.
2. Revisión docente de las fichas y del banco de preguntas.
3. Backend Node.js + PostgreSQL con autenticación en servidor y calificación verificada.
4. Carga de sistemas bajo demanda (un GLB por sistema) y compresión Draco/Meshopt.
5. Contenido regional avanzado (anatomía topográfica por regiones) y más estructuras
   (p. ej. músculos profundos, plexos, vasos abdominales).
