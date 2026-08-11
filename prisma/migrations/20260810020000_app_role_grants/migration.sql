DO $$
DECLARE
  app_role text := nullif(current_setting('app.app_db_username', true), '');
  app_password text := nullif(current_setting('app.app_db_password', true), '');
BEGIN
  IF app_role IS NULL THEN
    RAISE EXCEPTION 'Missing required database setting app.app_db_username for role grants migration';
  END IF;

  IF app_password IS NULL THEN
    RAISE EXCEPTION 'Missing required database setting app.app_db_password for role grants migration';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', app_role, app_password);
  ELSE
    EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', app_role, app_password);
  END IF;

  EXECUTE format('GRANT CONNECT, TEMPORARY, CREATE ON DATABASE %I TO %I', current_database(), app_role);
  EXECUTE format('GRANT USAGE, CREATE ON SCHEMA public TO %I', app_role);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', app_role);
  EXECUTE format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO %I', app_role);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', app_role);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I', app_role);
END $$;
