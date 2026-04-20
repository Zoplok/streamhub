CREATE TABLE IF NOT EXISTS roles (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

INSERT IGNORE INTO roles (name) VALUES ('admin'),('moderator'),('creator'),('viewer');

CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  username      VARCHAR(100) UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role_id       INT NOT NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS channels (
  id          CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id     CHAR(36) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  banner_url  TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS videos (
  id            CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  channel_id    CHAR(36) NOT NULL,
  title         VARCHAR(500) NOT NULL,
  description   TEXT,
  hls_url       TEXT,
  thumbnail_url TEXT,
  duration      INT NOT NULL DEFAULT 0,
  status        VARCHAR(50) NOT NULL DEFAULT 'processing',
  views         INT NOT NULL DEFAULT 0,
  tags          JSON NOT NULL DEFAULT (JSON_ARRAY()),
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);
CREATE INDEX idx_videos_channel ON videos(channel_id);
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX idx_videos_status ON videos(status);
CREATE FULLTEXT INDEX idx_videos_title_ft ON videos(title, description);

CREATE TABLE IF NOT EXISTS shorts (
  id            CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  channel_id    CHAR(36) NOT NULL,
  title         VARCHAR(500) NOT NULL,
  video_url     TEXT NOT NULL,
  thumbnail_url TEXT,
  duration      INT NOT NULL DEFAULT 0,
  views         INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);
CREATE INDEX idx_shorts_created_at ON shorts(created_at DESC);

CREATE TABLE IF NOT EXISTS live_streams (
  id           CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  channel_id   CHAR(36) NOT NULL,
  title        VARCHAR(500) NOT NULL,
  stream_key   VARCHAR(255) UNIQUE NOT NULL,
  status       VARCHAR(50) NOT NULL DEFAULT 'idle',
  viewer_count INT NOT NULL DEFAULT 0,
  hls_url      TEXT,
  started_at   TIMESTAMP NULL,
  ended_at     TIMESTAMP NULL,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);
CREATE INDEX idx_streams_status ON live_streams(status);

CREATE TABLE IF NOT EXISTS subscriptions (
  id            CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  subscriber_id CHAR(36) NOT NULL,
  channel_id    CHAR(36) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(subscriber_id, channel_id),
  FOREIGN KEY (subscriber_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);
CREATE INDEX idx_subs_channel ON subscriptions(channel_id);

CREATE TABLE IF NOT EXISTS comments (
  id         CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id    CHAR(36) NOT NULL,
  video_id   CHAR(36) NULL,
  short_id   CHAR(36) NULL,
  parent_id  CHAR(36) NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  FOREIGN KEY (short_id) REFERENCES shorts(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
  CHECK ((video_id IS NOT NULL) + (short_id IS NOT NULL) = 1)
);
CREATE INDEX idx_comments_video ON comments(video_id);
CREATE INDEX idx_comments_short ON comments(short_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);

CREATE TABLE IF NOT EXISTS reactions (
  id          CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id     CHAR(36) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id   CHAR(36) NOT NULL,
  type        VARCHAR(50) NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, target_type, target_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_reactions_target ON reactions(target_type, target_id);

CREATE TABLE IF NOT EXISTS watch_history (
  id               CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id          CHAR(36) NOT NULL,
  video_id         CHAR(36) NOT NULL,
  watched_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  progress_seconds INT NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);
CREATE INDEX idx_watch_user ON watch_history(user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  stream_id  CHAR(36) NOT NULL,
  user_id    CHAR(36) NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (stream_id) REFERENCES live_streams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_chat_stream ON chat_messages(stream_id, created_at);

CREATE TABLE IF NOT EXISTS reports (
  id          CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  reporter_id CHAR(36) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id   CHAR(36) NOT NULL,
  reason      TEXT NOT NULL,
  status      VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_reports_status ON reports(status);

-- Idempotent ALTERs (ER_DUP_FIELDNAME / ER_DUP_KEYNAME are ignored by migrate script)
ALTER TABLE channels ADD COLUMN avatar_url TEXT;
ALTER TABLE channels ADD COLUMN category VARCHAR(50);
ALTER TABLE videos ADD COLUMN category VARCHAR(50);
ALTER TABLE live_streams ADD COLUMN thumbnail_url TEXT;
ALTER TABLE live_streams ADD COLUMN category VARCHAR(50);
CREATE INDEX idx_videos_category ON videos(category);
CREATE INDEX idx_streams_category ON live_streams(category);

CREATE TABLE IF NOT EXISTS notifications (
  id         CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id    CHAR(36) NOT NULL,
  actor_id   CHAR(36) NULL,
  type       VARCHAR(50) NOT NULL,
  title      VARCHAR(255) NOT NULL,
  body       VARCHAR(500) NULL,
  link       VARCHAR(500) NULL,
  thumbnail  VARCHAR(500) NULL,
  read_at    TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_notif_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notif_user_unread ON notifications(user_id, read_at);
