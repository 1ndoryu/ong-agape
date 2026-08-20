-- Revertir migración inicial
DROP TABLE IF EXISTS transparency_entries;
DROP TABLE IF EXISTS audit_events;
DROP TABLE IF EXISTS transparency_content;
DROP TABLE IF EXISTS payment_receipts;
DROP TABLE IF EXISTS payment_methods;
DROP TABLE IF EXISTS notes;
DROP TABLE IF EXISTS users;
DROP EXTENSION IF EXISTS "uuid-ossp";
