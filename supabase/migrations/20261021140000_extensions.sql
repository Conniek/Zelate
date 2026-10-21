-- DEV-1 step 1/11: extensions (BACKEND_SCHEMA §12).
create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
