import type { MeshMap } from '../../core/types';

/**
 * Asociación entre los nombres de malla de un GLB y las fichas anatómicas.
 *
 * Si las mallas del GLB ya siguen la convención `<structureId>[__l|__r]`
 * (p. ej. `femur__l`), no hace falta ninguna entrada: el visor las resuelve solo.
 * Use este mapa cuando el modelo tenga nombres propios del artista, por ejemplo:
 *
 *   'Femur_L': { structureId: 'femur', side: 'l' },
 *   'Heart':   { structureId: 'cor' },
 *
 * También puede generarse desde Administración → Modelo 3D (exporta JSON).
 */
export const DOG_GLB_MESHMAP: MeshMap = {};
