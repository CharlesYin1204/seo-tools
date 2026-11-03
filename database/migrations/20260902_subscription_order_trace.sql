SET @has_source_order := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'source_order_id'
);
SET @add_source_order := IF(
  @has_source_order = 0,
  'ALTER TABLE subscriptions ADD COLUMN source_order_id VARCHAR(64) NULL AFTER cancel_at_period_end',
  'SELECT 1'
);
PREPARE add_source_order_stmt FROM @add_source_order;
EXECUTE add_source_order_stmt;
DEALLOCATE PREPARE add_source_order_stmt;

SET @has_source_order_index := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscriptions' AND INDEX_NAME = 'uk_sub_source_order'
);
SET @add_source_order_index := IF(
  @has_source_order_index = 0,
  'CREATE UNIQUE INDEX uk_sub_source_order ON subscriptions(source_order_id)',
  'SELECT 1'
);
PREPARE add_source_order_index_stmt FROM @add_source_order_index;
EXECUTE add_source_order_index_stmt;
DEALLOCATE PREPARE add_source_order_index_stmt;
