/**
 * 数据库配置与连接池管理
 * 使用mysql2/promise连接池，连接PHP版共享的MySQL数据库
 */
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

let pool = null;

/**
 * 创建数据库连接池
 */
function createPool() {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    database: process.env.DB_DATABASE || 'shexpatshome',
    user: process.env.DB_USERNAME || 'shexpatshome',
    password: process.env.DB_PASSWORD || 'shexpatshome',
    charset: process.env.DB_CHARSET || 'utf8mb4',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_MAX, 10) || 10,
    queueLimit: 0,
    // Limit per-connection prepared statement cache to reduce server-side stmt pressure
    maxPreparedStatements: 100,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    timezone: '+08:00',
    dateStrings: true,
  });

  logger.info('MySQL连接池已创建', {
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
  });

  return pool;
}

/**
 * 获取数据库连接池
 */
function getPool() {
  if (!pool) {
    createPool();
  }
  return pool;
}

/**
 * 执行SQL查询（自动从连接池获取连接）
 * @param {string} sql - SQL语句
 * @param {Array} params - 查询参数
 * @returns {Promise<Array>} 查询结果
 */
async function query(sql, params = []) {
  const db = getPool();
  try {
    const [rows] = await db.query(sql, params);
    return rows;
  } catch (error) {
    logger.error('数据库查询错误', { sql, params, error: error.message });
    throw error;
  }
}

/**
 * 执行事务
 * @param {Function} callback - 事务回调函数，接收connection参数
 * @returns {Promise<any>} 事务结果
 */
async function transaction(callback) {
  const db = getPool();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    logger.error('事务执行失败', { error: error.message });
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 测试数据库连接
 */
async function testConnection() {
  try {
    const db = getPool();
    const connection = await db.getConnection();
    await connection.ping();
    connection.release();
    logger.info('数据库连接测试成功');
    return true;
  } catch (error) {
    logger.error('数据库连接测试失败', { error: error.message });
    return false;
  }
}

/**
 * 关闭连接池
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('数据库连接池已关闭');
  }
}

module.exports = {
  createPool,
  getPool,
  query,
  transaction,
  testConnection,
  closePool,
};
