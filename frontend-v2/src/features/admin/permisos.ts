/* Matriz de permisos espejo de src/domain/permissions.rs. El backend es la
 * autoridad final; esta matriz solo oculta en la UI lo que el rol no puede
 * hacer, para evitar formularios que terminen en 403. */

import type { RolAdmin } from './apiAdmin';

export type CapacidadAdmin =
  | 'ReadPanel'
  | 'WriteLedger'
  | 'ReviewLedger'
  | 'ManageContent'
  | 'ManagePaymentMethods'
  | 'ReadAudit';

const MATRIZ: Record<CapacidadAdmin, RolAdmin[]> = {
  ReadPanel: ['owner', 'finance_editor', 'auditor', 'viewer'],
  WriteLedger: ['owner', 'finance_editor'],
  ReviewLedger: ['owner', 'auditor'],
  ManageContent: ['owner', 'finance_editor'],
  ManagePaymentMethods: ['owner'],
  ReadAudit: ['owner', 'auditor'],
};

export function puede(rol: RolAdmin, capacidad: CapacidadAdmin): boolean {
  return MATRIZ[capacidad].includes(rol);
}

export const ETIQUETAS_ROL: Record<RolAdmin, string> = {
  owner: 'Propietario',
  finance_editor: 'Editor financiero',
  auditor: 'Auditor',
  viewer: 'Observador',
};
