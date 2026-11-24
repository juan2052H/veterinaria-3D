# Backend (siguiente fase)

La primera versión funciona sin servidor: cuentas, progreso y contenido administrado se
guardan en el navegador (`localStorage`), con contraseñas derivadas con PBKDF2-SHA256.
Es adecuada para uso individual y demostraciones, **no** para un despliegue institucional:
los datos no se comparten entre dispositivos y un administrador local no es una
autenticación real.

## Migración prevista

1. API REST en Node.js (Fastify o Express) con el esquema `schema.sql`.
2. Contraseñas con argon2id; sesión con cookie `HttpOnly`, `Secure`, `SameSite=Lax`;
   protección CSRF; límite de intentos de inicio de sesión.
3. Roles `student`, `teacher`, `admin` verificados en el servidor.
4. La calificación de cuestionarios se recalcula en el servidor (reutilizando
   `src/quiz/engine.ts`, que es lógica pura) para que el resultado no pueda manipularse
   desde el navegador.
5. Modelos GLB en almacenamiento de objetos con CDN y caché.

En el frontend solo hay que reimplementar `src/services/storage.ts` y las acciones de los
stores (`src/store/*.ts`) para que llamen a la API; los componentes no cambian.
