DROP TABLE IF EXISTS checkout_intents;

ALTER TABLE payment_methods
    DROP COLUMN provider_secrets,
    DROP COLUMN provider_config;
