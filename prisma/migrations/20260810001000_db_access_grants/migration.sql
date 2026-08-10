-- Ensure the application role can connect to the target DB and read/write schema objects.
-- This migration is safe to re-run.
DO $$
DECLARE
  db_name text := current_database();
  app_role text := 'flashcards';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
    EXECUTE format('GRANT CONNECT, TEMPORARY, CREATE ON DATABASE %I TO %I', db_name, app_role);
    EXECUTE format('GRANT USAGE, CREATE ON SCHEMA public TO %I', app_role);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', app_role);
    EXECUTE format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO %I', app_role);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', app_role);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I', app_role);
  END IF;
END $$;
