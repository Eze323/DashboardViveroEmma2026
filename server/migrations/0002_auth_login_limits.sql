CREATE TABLE IF NOT EXISTS auth_login_attempts (
  key varchar(64) PRIMARY KEY,
  failure_count integer NOT NULL DEFAULT 0,
  window_started_at timestamp without time zone NOT NULL DEFAULT now(),
  locked_until timestamp without time zone,
  updated_at timestamp without time zone NOT NULL DEFAULT now()
);
