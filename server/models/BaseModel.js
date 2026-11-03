/**
 * 数据模型基类
 * 提供通用的CRUD操作，所有模型继承此类
 */
const { query, transaction } = require('../config/database');

class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
  }

  /**
   * 根据ID查找单条记录
   */
  async findById(id) {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ? LIMIT 1`;
    const rows = await query(sql, [id]);
    return rows[0] || null;
  }

  /**
   * 根据条件查找单条记录
   * @param {Object} conditions - {field: value} 条件
   */
  async findOne(conditions) {
    const { where, params } = this._buildWhere(conditions);
    const sql = `SELECT * FROM ${this.tableName} ${where} LIMIT 1`;
    const rows = await query(sql, params);
    return rows[0] || null;
  }

  /**
   * 根据条件查找多条记录
   * @param {Object} options - { where, orderBy, limit, offset }
   */
  async findAll(options = {}) {
    const {
      where: conditions = {},
      orderBy = 'id DESC',
      limit = 100,
      offset = 0,
      select = '*',
    } = options;

    const { where, params } = this._buildWhere(conditions);
    const sql = `SELECT ${select} FROM ${this.tableName} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    return query(sql, params);
  }

  /**
   * 分页查询
   * @param {Object} options - { where, orderBy, page, pageSize }
   */
  async paginate(options = {}) {
    const {
      where: conditions = {},
      orderBy = 'id DESC',
      page = 1,
      pageSize = 20,
      select = '*',
    } = options;

    const { where, params } = this._buildWhere(conditions);
    const countSql = `SELECT COUNT(*) as total FROM ${this.tableName} ${where}`;
    const [countResult] = await query(countSql, [...params]);
    const total = countResult ? countResult.total : 0;

    const offset = (page - 1) * pageSize;
    const dataSql = `SELECT ${select} FROM ${this.tableName} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    const data = await query(dataSql, [...params, pageSize, offset]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 插入单条记录
   * @returns {number} 新插入的ID
   */
  async create(data) {
    const fields = Object.keys(data);
    const placeholders = fields.map(() => '?').join(', ');
    const values = fields.map((f) => data[f]);
    const sql = `INSERT INTO ${this.tableName} (${fields.join(', ')}) VALUES (${placeholders})`;
    const result = await query(sql, values);
    return result.insertId;
  }

  /**
   * 根据ID更新记录
   */
  async update(id, data) {
    const fields = Object.keys(data);
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const values = [...fields.map((f) => data[f]), id];
    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
    const result = await query(sql, values);
    return result.affectedRows;
  }

  /**
   * 根据条件更新记录
   */
  async updateWhere(conditions, data) {
    const fields = Object.keys(data);
    const setClause = fields.map((f) => `${f} = ?`).join(', ');
    const setValues = fields.map((f) => data[f]);
    const { where, params } = this._buildWhere(conditions);
    const sql = `UPDATE ${this.tableName} SET ${setClause} ${where}`;
    const result = await query(sql, [...setValues, ...params]);
    return result.affectedRows;
  }

  /**
   * 根据ID删除记录
   */
  async delete(id) {
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    const result = await query(sql, [id]);
    return result.affectedRows;
  }

  /**
   * 根据条件删除记录
   */
  async deleteWhere(conditions) {
    const { where, params } = this._buildWhere(conditions);
    const sql = `DELETE FROM ${this.tableName} ${where}`;
    const result = await query(sql, params);
    return result.affectedRows;
  }

  /**
   * 统计符合条件的记录数
   */
  async count(conditions = {}) {
    const { where, params } = this._buildWhere(conditions);
    const sql = `SELECT COUNT(*) as total FROM ${this.tableName} ${where}`;
    const [result] = await query(sql, params);
    return result ? result.total : 0;
  }

  /**
   * 执行原生SQL
   */
  async raw(sql, params = []) {
    return query(sql, params);
  }

  /**
   * 执行事务
   */
  async transaction(callback) {
    return transaction(callback);
  }

  /**
   * 构建WHERE子句
   * @private
   */
  _buildWhere(conditions) {
    if (!conditions || Object.keys(conditions).length === 0) {
      return { where: '', params: [] };
    }

    const clauses = [];
    const params = [];

    for (const [key, value] of Object.entries(conditions)) {
      if (value === null) {
        clauses.push(`${key} IS NULL`);
      } else if (Array.isArray(value)) {
        const placeholders = value.map(() => '?').join(', ');
        clauses.push(`${key} IN (${placeholders})`);
        params.push(...value);
      } else if (typeof value === 'object' && value.op) {
        clauses.push(`${key} ${value.op} ?`);
        params.push(value.value);
      } else {
        clauses.push(`${key} = ?`);
        params.push(value);
      }
    }

    return {
      where: `WHERE ${clauses.join(' AND ')}`,
      params,
    };
  }
}

module.exports = BaseModel;
