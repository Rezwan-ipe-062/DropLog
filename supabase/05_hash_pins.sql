-- ============================================================================
-- DROPLOG — 05: HASH EXISTING PINS (One-time Migration)
-- Name this SQL tab:  "05 - Hash Existing PINs"
-- ============================================================================
-- WHAT THIS SCRIPT DOES:
--   Migrates all plaintext PINs in the `users` table to SHA-256 hashes
--   using PostgreSQL's pgcrypto extension. After running, every PIN value
--   is a 64-character hex string instead of a 4-digit number.
--
-- WHY THIS IS NEEDED:
--   PINs were originally stored in plaintext (e.g. '0001'). All application
--   code now hashes PINs client-side using the Web Crypto API (SubtleCrypto)
--   before sending to the database. This migration hashes existing records
--   so they match the incoming client-side hashes.
--
-- HOW TO USE:
--   1. Open Supabase SQL Editor
--   2. Create a NEW tab (click "New query")
--   3. Rename the tab to:  05 - Hash Existing PINs
--   4. Paste this entire script and click RUN
--
--   Run this AFTER deploying the updated auth.js, config.js, and users.js
--   files (which contain the hashPin() function). Run BEFORE any user tries
--   to log in with the new code, otherwise logins will fail (plaintext PIN
--   in DB won't match the hash the client now sends).
--
-- SAFETY:
--   - CREATE EXTENSION IF NOT EXISTS — safe to re-run
--   - UPDATE WHERE length(pin) < 64 — only affects plaintext rows;
--     already-hashed rows (64 chars) are skipped
--   - Idempotent — running twice will skip already-hashed rows
--
-- TABLE AFFECTED: users
--
-- users.pin column:
--   BEFORE: 4-digit string ('0001')
--   AFTER:  64-char SHA-256 hex ('276af56a3cb21a3c19c569141151882cb...')
--   Note:  The hash input is pin + salt ('droplog_salt_v1'), matching the
--          client-side hashPin() function in config.js.
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
