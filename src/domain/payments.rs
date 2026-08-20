//! Contratos agnósticos para proveedores y comprobantes de pago.

use serde::{Deserialize, Serialize};

/// Proveedores soportados por el primer diseño del módulo de donaciones.
#[derive(Debug, Clone, Copy, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymentProvider {
    Paypal,
    Stripe,
    PagoMovil,
    Transfer,
    Zelle,
}

/// Un proveedor automático usa confirmación remota; uno manual requiere revisión humana.
#[derive(Debug, Clone, Copy, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymentMode {
    Automatic,
    Manual,
}

/// Estados que pueden mostrarse de forma segura sin filtrar secretos del proveedor.
#[derive(Debug, Clone, Copy, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymentMethodStatus {
    Enabled,
    Disabled,
    SetupRequired,
}

/// Configuración pública de un método. Nunca contiene API keys, tokens ni firmas.
#[derive(Debug, Clone, Deserialize, Eq, PartialEq, Serialize)]
pub struct PaymentMethodDefinition {
    pub provider: PaymentProvider,
    pub label: String,
    pub mode: PaymentMode,
    pub status: PaymentMethodStatus,
    pub display_order: i32,
}

/// Contrato mínimo para adaptar `PayPal`, Stripe u otro proveedor sin acoplar el dominio.
pub trait PaymentAdapter {
    fn provider(&self) -> PaymentProvider;

    fn mode(&self) -> PaymentMode;

    fn supports_webhooks(&self) -> bool;
}

/// Estado del comprobante antes de convertirse en un ingreso publicado.
#[derive(Debug, Clone, Copy, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymentReceiptStatus {
    PendingVerification,
    Approved,
    Rejected,
}
