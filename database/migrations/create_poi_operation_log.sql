-- POI操作日志表 - 记录小区POI数据的新增/删除等操作
CREATE TABLE IF NOT EXISTS poi_operation_log (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  operation_type ENUM('add', 'delete', 'import', 'batch_delete', 'clear') NOT NULL COMMENT '操作类型',
  affected_count INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '影响记录数',
  operator_id INT UNSIGNED DEFAULT NULL COMMENT '操作人ID',
  detail TEXT DEFAULT NULL COMMENT '操作详情JSON',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_operation_type (operation_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='POI操作日志表';
