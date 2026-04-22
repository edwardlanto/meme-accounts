-- Track token expiration / re-auth status for social connections.
-- When a publish attempt fails with an auth error, the worker/publish route
-- sets `needs_reauth = true` and records the error message. The UI can then
-- show a "Reconnect" button for that connection.

alter table public.social_connections
  add column if not exists needs_reauth boolean not null default false,
  add column if not exists last_auth_error text;
