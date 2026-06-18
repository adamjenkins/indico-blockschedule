-- Runs once, at first container startup, against the POSTGRES_DB ('indico').
-- Required by Indico — see ../../indico/docs/source/installation/development.rst
-- ("Creating the DB") and indico/testing/fixtures/database.py.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- A second database for pytest's INDICO_TEST_DATABASE_URI, kept separate from
-- the 'indico' database used by a manually-running dev server so test runs
-- (which create/drop all tables) never touch data you're looking at in the UI.
CREATE DATABASE indico_test;
\connect indico_test
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
