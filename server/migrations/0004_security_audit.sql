ALTER TYPE role ADD VALUE IF NOT EXISTS 'vendedor';

BEGIN;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'encargado', 'vendedor', 'operario', 'user'));

CREATE TABLE IF NOT EXISTS audit_logs (
  id bigserial PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id),
  action varchar(100) NOT NULL,
  entity varchar(100) NOT NULL,
  entity_id varchar(255) NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address varchar(45),
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_entity_created_at_idx
  ON audit_logs (entity, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_user_created_at_idx
  ON audit_logs (user_id, created_at DESC);

COMMIT;
