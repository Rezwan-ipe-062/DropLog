-- ============================================================================
-- DROPLOG — 05: HASH EXISTING PINS (One-time Migration)
-- Name this SQL tab:  "05 - Hash Existing PINs"
-- ============================================================================
-- WHAT THIS SCRIPT DOES:
--   Hashes all existing plaintext PINs in the users table using
--   PostgreSQL's built-in pgcrypto extension (SHA-256 with salt).
--   After this migration, all PINs are stored as hex-encoded SHA-256 hashes.
--
-- WHY: PINs were previously stored in plaintext. All login code has been
--      updated to hash PINs client-side before sending to the database.
--      This migration ensures existing records are compatible.
--
-- RUN THIS: After deploying the code changes (hash in auth.js, users.js).
--            Run ONLY ONCE.
--
-- SAFETY: Idempotent — uses IF NOT EXISTS for extension.
--          Can be re-run (hashing an already-hashed value again won't match
--          client-side hashes, so existing sessions would break — but that's
--          actually a security feature for re-migration).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Hash all existing PINs using SHA-256 with the same salt used client-side
UPDATE users
SET pin = encode(digest(pin || 'droplog_salt_v1', 'sha256'), 'hex')
WHERE length(pin) < 64;  -- Only hash plaintext PINs (hashes are 64 chars)

-- Verify: should show 64-char hex strings for all users
SELECT user_id, role, length(pin) AS pin_len, 
       CASE WHEN length(pin) = 64 THEN 'HASHED' ELSE 'PLAINTEXT' END AS status
FROM users
ORDER BY user_id;
