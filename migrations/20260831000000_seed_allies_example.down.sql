-- Revierte el seed de ejemplo de aliados sin tocar aliados creados por el
-- panel. Se borra solo por nombre para no afectar a otros del mismo nombre.
DELETE FROM allies
WHERE nombre IN (
    'Fundación Manos Abiertas',
    'Distribuidora Oriente',
    'Farmacias La Salud',
    'Voluntarios Barcelona'
);
