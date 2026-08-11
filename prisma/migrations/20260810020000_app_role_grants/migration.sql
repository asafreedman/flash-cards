DO $$
DECLARE
  app_role text := coalesce(nullif(current_setting('app.app_db_username', true), ''), 'flashcards_app');
  app_password text := nullif(current_setting('app.app_db_password', true), '');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
    IF app_password IS NULL THEN
      RAISE EXCEPTION 'Role % does not exist and app.app_db_password was not provided; set APP_DB_PASSWORD via migration environment or create role first', app_role;
    END IF;

    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', app_role, app_password);
  ELSIF app_password IS NOT NULL THEN
    EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', app_role, app_password);
  END IF;

  EXECUTE format('GRANT CONNECT, TEMPORARY, CREATE ON DATABASE %I TO %I', current_database(), app_role);
  EXECUTE format('GRANT USAGE, CREATE ON SCHEMA public TO %I', app_role);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', app_role);
  EXECUTE format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO %I', app_role);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', app_role);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I', app_role);
END $$;
