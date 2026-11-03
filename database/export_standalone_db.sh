#!/bin/bash
# =========================================
# 独立版数据库导出脚本
# 仅导出系统核心数据，排除SaaS用户数据
# =========================================

# 配置
DB_HOST="localhost"
DB_USER="juzhen_iyunxuan"
DB_PASS="juzhen_iyunxuan"
DB_NAME="juzhen_iyunxuan"
OUTPUT_FILE="database/standalone_database.sql"

echo "开始导出独立版数据库..."

# 1. 导出数据库结构（所有表）
echo "-- 微信公众号矩阵系统 - 独立版数据库" > $OUTPUT_FILE
echo "-- 生成时间: $(date '+%Y-%m-%d %H:%M:%S')" >> $OUTPUT_FILE
echo "-- 注意: 此数据库仅包含系统核心配置，不包含用户数据" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "SET NAMES utf8mb4;" >> $OUTPUT_FILE
echo "SET FOREIGN_KEY_CHECKS = 0;" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# 导出表结构
mysqldump -h$DB_HOST -u$DB_USER -p$DB_PASS --no-data $DB_NAME >> $OUTPUT_FILE 2>/dev/null

# 2. 只导出必要的核心数据表
echo "" >> $OUTPUT_FILE
echo "-- ==========================================" >> $OUTPUT_FILE
echo "-- 核心数据（AI模型、插件、系统配置等）" >> $OUTPUT_FILE
echo "-- ==========================================" >> $OUTPUT_FILE

# 需要保留数据的核心表
CORE_TABLES=(
    "ai_models"
    "ai_knowledge_bases"
    "wechat_plugins"
    "wechat_plugin_categories"
    "system_settings"
    "system_configs"
    "system_versions"
    "membership_packages"
    "points_packages"
)

for TABLE in "${CORE_TABLES[@]}"; do
    echo "导出表: $TABLE"
    mysqldump -h$DB_HOST -u$DB_USER -p$DB_PASS --no-create-info --complete-insert $DB_NAME $TABLE >> $OUTPUT_FILE 2>/dev/null
done

# 3. 创建默认管理员账户
echo "" >> $OUTPUT_FILE
echo "-- ==========================================" >> $OUTPUT_FILE
echo "-- 默认管理员账户" >> $OUTPUT_FILE
echo "-- 用户名: admin, 密码: admin123 (请登录后立即修改)" >> $OUTPUT_FILE
echo "-- ==========================================" >> $OUTPUT_FILE
echo "INSERT INTO users (id, username, email, password, role, status, created_at, updated_at) VALUES" >> $OUTPUT_FILE
echo "(1, 'admin', 'admin@localhost', '\$2y\$10\$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'active', NOW(), NOW());" >> $OUTPUT_FILE

echo "" >> $OUTPUT_FILE
echo "SET FOREIGN_KEY_CHECKS = 1;" >> $OUTPUT_FILE

echo "独立版数据库导出完成: $OUTPUT_FILE"
echo "数据库大小: $(du -h $OUTPUT_FILE | cut -f1)"
