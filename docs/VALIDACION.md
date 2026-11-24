# Validación del contenido anatómico

## Estado

Las 84 fichas del perro, las 25 preguntas redactadas y el glosario se escribieron a partir
de obras de referencia estándar:

- Hermanson, de Lahunta & Evans. *Miller and Evans' Anatomy of the Dog*, 5.ª ed., 2020.
- König & Liebich. *Veterinary Anatomy of Domestic Animals*, 7.ª ed., 2020.
- Singh. *Dyce, Sack and Wensing's Textbook of Veterinary Anatomy*, 5.ª ed., 2018.
- *Nomina Anatomica Veterinaria*, 6.ª ed., 2017.

Todas las fichas están marcadas como **«Pendiente de revisión docente»** (`reviewStatus: 'borrador'`).
Se incluyeron solo datos ampliamente establecidos; cuando una cifra varía entre autores
o individuos (p. ej. número de vértebras caudales, nivel de terminación de la médula,
posición de los riñones) se indica como aproximada.

## Procedimiento de revisión propuesto

1. Un docente de anatomía veterinaria revisa cada ficha desde **Administración → Fichas**.
2. Corrige el texto si es necesario y cambia el estado a **«Revisado por docente»**.
3. Las correcciones se guardan como *overrides*; para incorporarlas al código fuente,
   trasládelas a `src/species/dog/structures.ts` y cambie `reviewStatus` a `'revisado'`.
4. Las preguntas se revisan en `src/species/dog/questions.ts`. Las preguntas generadas
   automáticamente (`src/quiz/engine.ts`) derivan de las fichas, por lo que heredan su revisión.

## Pruebas automáticas relacionadas

`npm test` verifica, entre otras cosas, que:

- cada estructura tenga malla en el modelo (y ambas si es bilateral);
- las relaciones (`relatedIds`) y las preguntas apunten a fichas existentes;
- las preguntas de selección múltiple tengan una respuesta válida y opciones únicas;
- la calificación sea correcta (tildes, mayúsculas, crédito parcial en «relacionar»).
