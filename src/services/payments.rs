//! Registro seguro de capacidades de proveedores. Los secretos nunca se serializan al frontend.

pub struct PaymentService;

impl PaymentService {
    #[must_use]
    pub fn automatic_provider_ready(provider: &str) -> bool {
        match provider {
            "paypal" => all_present(&[
                "PAYPAL_CLIENT_ID",
                "PAYPAL_CLIENT_SECRET",
                "PAYPAL_WEBHOOK_ID",
            ]),
            "stripe" => all_present(&["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]),
            _ => false,
        }
    }
}

fn all_present(keys: &[&str]) -> bool {
    keys.iter()
        .all(|key| std::env::var(key).is_ok_and(|value| !value.trim().is_empty()))
}
