psql "postgresql://un80devpgadmin80:PASSWORD@un80-dev-pg.postgres.database.azure.com:5432/postgres?sslmode=require" \
  -c "DROP SCHEMA IF EXISTS mandates_housekeeping CASCADE;" \
  -f sql/schema/create_auth_tables.sql \
  -f sql/schema/create_housekeeping_tables.sql
