# Incorporar modelos anatómicos 3D

El visor no depende de ningún modelo concreto. Cualquier archivo **GLB/GLTF** puede
usarse siempre que cada malla pueda asociarse a una ficha anatómica.

## 1. Estado actual

La especie *Perro* incluye un **modelo esquemático provisional** generado por código
(`src/species/dog/schematicModel.ts`, módulos en `src/species/dog/model/`). Tiene una
malla independiente por estructura (≈205 mallas, 125 fichas).

### Versión 2 (noviembre de 2026): modelado orgánico

| Aspecto | Cómo se resuelve |
|---|---|
| Geometría | Campos de distancia (SDF, `src/species/dog/sdf.ts`): cada estructura es una unión suave de primitivas con sus accidentes (cóndilos, tubérculos, apófisis, forámenes, lóbulos, cisuras), poligonizada con *surface nets* |
| Esqueleto | Cráneo hueco con órbitas, arcos cigomáticos y bulas; 42 dientes; vértebras con arco, canal, apófisis espinosas (vértebra anticlinal T11) y transversas; costillas con cartílagos costales y arco costal; huesos largos con epífisis; foramen supratroclear; mano y pie con carpo/tarso, metapodios, falanges y sesamoideos |
| Músculos | ≈40 por lado (incluidos epaxiales, intercostales externos, iliopsoas y los principales del antebrazo y la pierna, con tendones hasta los dedos), con dirección de fibras, aponeurosis e intersecciones tendinosas; clasificados como superficiales o profundos |
| Vísceras | Corazón con atrios, orejuelas, ventrículos y grasa en los surcos coronarios; pulmones lobulados con cisuras; árbol bronquial; hígado con lóbulos e impresión renal; tubo digestivo completo; aparato urogenital de ambos sexos |
| Tegumento | Piel, tejido subcutáneo y fascia superficial extraídos del mismo campo (concéntricos), ajustados a los relieves musculares y óseos; almohadillas y uñas; orejas, trufa, hendiduras palpebrales |
| Materiales | `src/viewer/tissueMaterials.ts`: PBR (MeshPhysicalMaterial) con microrrelieve y variación de color procedurales por tejido (fibras musculares, porosidad ósea, lobulillos pulmonares, circunvoluciones, pelaje…), con antialiasing; sin texturas descargadas |
| Presentación | Iluminación de estudio con sombras suaves, entorno de *softboxes* para los reflejos, transiciones suaves entre capas |
| Disección | 8 pasos: piel → subcutáneo → fascia → músculos superficiales → profundos → vísceras → sistema nervioso → esqueleto |
| Rendimiento | Generación en un Web Worker (≈6–9 s la primera vez, sin bloquear la interfaz) y caché en IndexedDB para las visitas siguientes (incrementar `MODEL_VERSION` en `modelCache.ts` al cambiar la geometría); ≈2,7 M triángulos en total, de los que solo se dibujan los sistemas visibles. `npm run model:stats` muestra el detalle |

### Lo que este modelo NO es

**No es un modelo anatómico validado ni hiperrealista.** Se construye a partir de
descripciones de la bibliografía, no de un espécimen ni de imágenes (TC/RM), y la
interfaz lo indica de forma permanente. Limitaciones conocidas:

- Las proporciones y formas son aproximadas; los músculos son vientres y láminas
  simplificados (faltan, entre otros, los intercostales internos, el transverso y el
  oblicuo interno del abdomen, los rotadores de la cadera y los flexores profundos).
- No hay pelaje geométrico: el pelo se sugiere con el material.
- Las válvulas cardiacas, las cámaras internas y la mucosa no se modelan.
- La epidermis, la dermis, los folículos y las glándulas cutáneas son **estructuras
  microscópicas**: no pueden representarse con sentido en un modelo de cuerpo entero.
  Corresponden a una vista histológica aparte (posible ampliación futura).

## 1 bis. Estrategia hacia un modelo de calidad profesional

La fidelidad anatómica real solo se consigue con geometría obtenida de un espécimen.
El visor ya admite cualquier GLB, así que la sustitución es progresiva, sistema a sistema:

1. **Esqueleto a partir de TC.** Segmentar una tomografía de perro (3D Slicer, libre) con
   licencia que permita el uso; exportar cada hueso como malla. Es la fuente más fiable
   y accesible.
2. **Órganos a partir de TC/RM con contraste** o, si no se dispone de estudios, encargo a
   un ilustrador médico veterinario con las referencias de `core/bibliography.ts`.
3. **Músculos:** encargo profesional o compra de un modelo comercial de anatomía canina,
   **comprobando que la licencia cubra su distribución dentro de una aplicación**.
4. **Texturas:** fotografía de especímenes (con permiso del centro) o pintura digital
   sobre los UV del modelo profesional.
5. Cada sistema nuevo se declara como un GLB adicional (ver §6) y se mantiene el
   esquemático para los sistemas que aún no se hayan sustituido.
6. **Validación docente** de cada sistema antes de retirar el aviso de "no validado".

## 2. Requisitos del modelo definitivo

| Requisito | Detalle |
|---|---|
| Formato | `.glb` (preferido) o `.gltf` |
| Separación | Una malla por estructura y por lado (p. ej. fémur izquierdo y derecho por separado) |
| Nombres | Convención `<structureId>[__l\|__r]` o un `meshMap` (ver abajo) |
| Orientación | El animal mira hacia **+X**, dorsal es **+Y**, el lado derecho es **+Z**. Si no, use `transform` |
| Unidades | Libres: la cámara y los cortes se ajustan al tamaño del modelo |
| Optimización | Malla por estructura < 20 k triángulos; compresión Draco o Meshopt; texturas KTX2 si las hay |
| Licencia | Debe permitir el uso educativo (y comercial, si corresponde). Guarde el archivo de licencia junto al modelo |
| Validación | Revisión de un docente de anatomía veterinaria antes de publicarlo |

### Fuentes posibles (verifique la licencia de cada modelo)

- Modelos producidos a medida por un ilustrador médico a partir de tomografía o resonancia
  y de las referencias bibliográficas del proyecto.
- Repositorios académicos de modelos anatómicos veterinarios (algunas facultades publican
  modelos con licencias Creative Commons).
- Bancos comerciales de modelos 3D, comprobando que la licencia cubra la distribución
  dentro de una aplicación.

## 3. Convención de nombres

```
<structureId>[__l|__r][@male|@female]

femur__l          fémur izquierdo
cor               corazón (impar)
urethra@female    variante femenina de la uretra
```

Los `structureId` son las claves de `src/species/dog/structures.ts`. Sufijos que añaden
los exportadores (`.001`, `_1`) se ignoran automáticamente.

## 4. Si el modelo tiene nombres propios del artista

Use un mapa explícito en `src/species/dog/meshMap.ts`:

```ts
export const DOG_GLB_MESHMAP: MeshMap = {
  'Femur_L': { structureId: 'femur', side: 'l' },
  'Femur_R': { structureId: 'femur', side: 'r' },
  'Heart':   { structureId: 'cor' },
};
```

No hace falta escribirlo a mano: **Administración → Modelo 3D** permite cargar el GLB,
ver todas sus mallas, asociarlas con un desplegable, comprobar qué fichas quedan sin
malla y **exportar el JSON** del mapa.

## 5. Registrar el modelo

1. Copie el archivo a `public/models/dog/dog-anatomy.glb`.
2. En `src/species/dog/index.ts`, añada la fuente (ya está preparada como comentario):

```ts
models: [
  { kind: 'glb', label: 'Modelo anatómico', url: '/models/dog/dog-anatomy.glb',
    meshMap: DOG_GLB_MESHMAP,
    transform: { scale: 1, rotation: [0, 0, 0] } },
  // el modelo esquemático puede conservarse como segunda opción o eliminarse
],
```

El primer modelo de la lista es el que abre el explorador. Si hay más de uno, el panel
de sistemas muestra un selector.

## 6. Carga por partes

Para modelos muy grandes, divida el GLB por sistemas (`dog-oseo.glb`, `dog-muscular.glb`…)
y declare una fuente por archivo; el `AnnotatedModel` del visor ya admite cualquier
subárbol de escena. La siguiente mejora natural es cargar cada sistema bajo demanda al
activarlo en el panel (ver «Siguientes pasos» en el README).

## 7. Verificar

```bash
npm test          # comprueba que cada malla tenga ficha y cada ficha tenga malla
npm run model:preview   # (modelo esquemático) genera model-preview.png con vistas ortográficas
```

Para un GLB, la pestaña **Modelo 3D** del panel de administración muestra la cobertura.
