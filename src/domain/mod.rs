//! Dominio reutilizable de la operación de donaciones.
//!
//! Este módulo no conoce Axum, `SQLx` ni Glory RS. Las capas HTTP y persistencia
//! pueden adaptarlo a otro runtime sin cambiar las reglas de negocio.

pub mod payments;
pub mod permissions;
