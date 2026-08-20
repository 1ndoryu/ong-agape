DROP INDEX IF EXISTS idx_transparency_payment_receipt;
DROP INDEX IF EXISTS idx_blog_posts_public_date;
DROP TABLE IF EXISTS blog_posts;
ALTER TABLE transparency_entries
    DROP COLUMN IF EXISTS payment_receipt_id,
    DROP COLUMN IF EXISTS payment_method_id,
    DROP COLUMN IF EXISTS review_note;
DROP INDEX IF EXISTS idx_users_role_status;
ALTER TABLE users
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS role;
