/**
 * 数据库修复工具控制器
 * 检查数据库表状态、修复常见问题
 */
const { success, error } = require('../../utils/response');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

const EXPECTED_TABLES = [
  'users',
  'system_settings',
  'properties',
  'wechat_robot_expat_parsed_properties',
  'wechat_robot_expat_parse_queue',
  'wechat_robot_plugins',
  'wechat_robot_plugin_categories',
  'contact_agent_records',
  'appointments',
  'agent_profiles',
  'tenant_demands',
  'friend_links',
  'float_contact_settings',
  'property_scraper_sources',
  'property_scraper_tasks',
  'articles',
  'article_categories',
  'media',
  'menus',
  'notifications',
  'orders',
];

class DatabaseFixController {
  /**
   * 获取数据库表状态
   * GET /admin/database/status
   */
  async getStatus(req, res) {
    try {
      const tables = await query('SHOW TABLES');
      const dbName = process.env.DB_DATABASE || 'seo_tools';
      const columnKey = `Tables_in_${dbName}`;

      const existingTables = tables.map(row => {
        const keys = Object.keys(row);
        return row[columnKey] || row[keys[0]];
      });

      const tableStatus = EXPECTED_TABLES.map(table => ({
        table,
        exists: existingTables.includes(table),
      }));

      const missingTables = tableStatus.filter(t => !t.exists).map(t => t.table);
      const extraTables = existingTables.filter(t => !EXPECTED_TABLES.includes(t));

      let tableDetails = [];
      try {
        tableDetails = await query('SHOW TABLE STATUS');
      } catch (e) {
        logger.warn('无法获取TABLE STATUS', { error: e.message });
      }

      const detailMap = {};
      tableDetails.forEach(detail => {
        detailMap[detail.Name] = {
          engine: detail.Engine,
          rows: detail.Rows,
          data_length: detail.Data_length,
          index_length: detail.Index_length,
          auto_increment: detail.Auto_increment,
          collation: detail.Collation,
          create_time: detail.Create_time,
          update_time: detail.Update_time,
        };
      });

      return success(res, {
        total_existing: existingTables.length,
        total_expected: EXPECTED_TABLES.length,
        missing_count: missingTables.length,
        missing_tables: missingTables,
        extra_tables: extraTables,
        table_status: tableStatus,
        table_details: detailMap,
      });
    } catch (err) {
      logger.error('获取数据库状态失败', { error: err.message });
      return error(res, '获取数据库状态失败', 500);
    }
  }

  /**
   * 修复数据库表 - 创建缺失的表
   * POST /admin/database/fix  body: { tables: ['table_name'] } 或 { fix_all: true }
   */
  async fixTables(req, res) {
    try {
      const { tables: requestedTables, fix_all } = req.body;

      const allTables = await query('SHOW TABLES');
      const dbName = process.env.DB_DATABASE || 'seo_tools';
      const columnKey = `Tables_in_${dbName}`;
      const existingTables = allTables.map(row => {
        const keys = Object.keys(row);
        return row[columnKey] || row[keys[0]];
      });

      let tablesToFix = [];
      if (fix_all) {
        tablesToFix = EXPECTED_TABLES.filter(t => !existingTables.includes(t));
      } else if (Array.isArray(requestedTables)) {
        tablesToFix = requestedTables.filter(t => !existingTables.includes(t));
      } else {
        return error(res, '请指定要修复的表或设置fix_all为true', 400);
      }

      if (tablesToFix.length === 0) {
        return success(res, { fixed: [], skipped: [] }, '所有表已存在，无需修复');
      }

      const fixed = [];
      const failed = [];

      for (const table of tablesToFix) {
        const createSql = TABLE_SCHEMAS[table];
        if (!createSql) {
          failed.push({ table, reason: '没有预定义的建表SQL' });
          continue;
        }
        try {
          await query(createSql);
          fixed.push(table);
          logger.info('表已创建', { table });
        } catch (e) {
          failed.push({ table, reason: e.message });
          logger.error('创建表失败', { table, error: e.message });
        }
      }

      return success(res, { fixed, failed }, `修复完成：成功${fixed.length}个，失败${failed.length}个`);
    } catch (err) {
      logger.error('修复数据库失败', { error: err.message });
      return error(res, '修复数据库失败', 500);
    }
  }
}

const TABLE_SCHEMAS = {
  friend_links: `CREATE TABLE IF NOT EXISTS friend_links (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL DEFAULT '',
    url VARCHAR(500) NOT NULL DEFAULT '',
    logo VARCHAR(500) DEFAULT '',
    description VARCHAR(500) DEFAULT '',
    sort_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  float_contact_settings: `CREATE TABLE IF NOT EXISTS float_contact_settings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(50) NOT NULL DEFAULT 'custom',
    label VARCHAR(100) DEFAULT '',
    value VARCHAR(500) DEFAULT '',
    icon VARCHAR(200) DEFAULT '',
    sort_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  property_scraper_sources: `CREATE TABLE IF NOT EXISTS property_scraper_sources (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL DEFAULT '',
    url VARCHAR(500) NOT NULL DEFAULT '',
    type VARCHAR(50) DEFAULT 'web',
    config JSON DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    sort_order INT DEFAULT 0,
    last_scraped_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  property_scraper_tasks: `CREATE TABLE IF NOT EXISTS property_scraper_tasks (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    source_id INT UNSIGNED DEFAULT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    total_items INT DEFAULT 0,
    processed_items INT DEFAULT 0,
    error_message TEXT DEFAULT NULL,
    started_at DATETIME DEFAULT NULL,
    finished_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  tenant_demands: `CREATE TABLE IF NOT EXISTS tenant_demands (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL,
    title VARCHAR(200) NOT NULL DEFAULT '',
    description TEXT DEFAULT NULL,
    district VARCHAR(100) DEFAULT '',
    budget_min DECIMAL(10,2) DEFAULT NULL,
    budget_max DECIMAL(10,2) DEFAULT NULL,
    bedrooms INT DEFAULT NULL,
    move_in_date DATE DEFAULT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  wechat_robot_plugins: `CREATE TABLE IF NOT EXISTS wechat_robot_plugins (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL DEFAULT '',
    slug VARCHAR(100) DEFAULT '',
    description TEXT DEFAULT NULL,
    version VARCHAR(20) DEFAULT '1.0.0',
    status VARCHAR(20) DEFAULT 'inactive',
    config JSON DEFAULT NULL,
    sort_order INT DEFAULT 0,
    category_id INT UNSIGNED DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  wechat_robot_plugin_categories: `CREATE TABLE IF NOT EXISTS wechat_robot_plugin_categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL DEFAULT '',
    slug VARCHAR(100) DEFAULT '',
    description VARCHAR(500) DEFAULT '',
    sort_order INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  contact_agent_records: `CREATE TABLE IF NOT EXISTS contact_agent_records (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL,
    agent_id INT UNSIGNED DEFAULT NULL,
    property_id INT UNSIGNED DEFAULT NULL,
    contact_type VARCHAR(50) DEFAULT 'inquiry',
    message TEXT DEFAULT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  appointments: `CREATE TABLE IF NOT EXISTS appointments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL,
    agent_id INT UNSIGNED DEFAULT NULL,
    property_id INT UNSIGNED DEFAULT NULL,
    appointment_date DATETIME DEFAULT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  agent_profiles: `CREATE TABLE IF NOT EXISTS agent_profiles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED DEFAULT NULL,
    company_name VARCHAR(200) DEFAULT '',
    license_number VARCHAR(100) DEFAULT '',
    service_areas TEXT DEFAULT NULL,
    bio TEXT DEFAULT NULL,
    rating DECIMAL(3,2) DEFAULT 0.00,
    total_deals INT DEFAULT 0,
    is_verified TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
};

module.exports = new DatabaseFixController();
