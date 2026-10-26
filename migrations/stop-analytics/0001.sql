CREATE TABLE analytics_retention (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  state TEXT NOT NULL CHECK (state IN ('pending', 'ready', 'failed')),
  purged_at_ms INTEGER NOT NULL,
  activation_revision TEXT NOT NULL
) STRICT;
INSERT INTO analytics_retention VALUES (1, 'pending', 0, 'disabled');
CREATE TABLE stop_analytics (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL CHECK (length(session_id) = 36),
  event TEXT NOT NULL CHECK (event IN (
    'stop_guide_opened', 'stop_device_check_completed', 'stop_session_started', 'stop_session_ended',
    'stop_report_viewed', 'stop_training_recommendation_shown', 'stop_drill_started', 'stop_drill_completed',
    'stop_retest_started', 'stop_retest_completed', 'stop_storage_failure', 'stop_technical_error')),
  mode TEXT CHECK (mode IN ('baseline', 'replay', 'retest')),
  status TEXT CHECK (status IN ('completed', 'invalid', 'technical_failure')),
  passed INTEGER CHECK (passed IN (0, 1)),
  reason TEXT CHECK (reason IN ('none', 'input_check_failed', 'viewport_unsupported', 'browser_unsupported')),
  error_class TEXT CHECK (error_class IN ('unavailable', 'write_failed', 'record_integrity', 'report_render_failed')),
  received_at_ms INTEGER NOT NULL CHECK (received_at_ms >= 0),
  CHECK ((event = 'stop_session_started' AND mode IS NOT NULL) OR (event != 'stop_session_started' AND mode IS NULL)),
  CHECK ((event = 'stop_session_ended' AND status IS NOT NULL) OR (event != 'stop_session_ended' AND status IS NULL)),
  CHECK ((event = 'stop_device_check_completed' AND passed IS NOT NULL AND reason IS NOT NULL AND
    ((passed = 1 AND reason = 'none') OR (passed = 0 AND reason != 'none'))) OR
    (event != 'stop_device_check_completed' AND passed IS NULL AND reason IS NULL)),
  CHECK ((event = 'stop_storage_failure' AND error_class IS NOT NULL AND error_class IN ('unavailable', 'write_failed')) OR
    (event = 'stop_technical_error' AND error_class IS NOT NULL AND error_class IN ('record_integrity', 'report_render_failed')) OR
    (event NOT IN ('stop_storage_failure', 'stop_technical_error') AND error_class IS NULL))
) STRICT;
CREATE INDEX stop_analytics_expiry ON stop_analytics(received_at_ms);
