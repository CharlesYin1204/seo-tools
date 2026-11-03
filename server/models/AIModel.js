/**
 * AI模型配置模型
 * 对应数据库 ai_models 表
 */
const BaseModel = require('./BaseModel');

class AIModel extends BaseModel {
  constructor() {
    super('ai_models');
  }

  async findActive() {
    return this.findAll({
      where: { is_active: 1 },
      orderBy: 'sort_order ASC, id ASC',
    });
  }

  async findByCode(modelCode) {
    return this.findOne({ model_code: modelCode });
  }

  async findByType(modelType) {
    return this.findAll({
      where: { model_type: modelType, is_active: 1 },
      orderBy: 'sort_order ASC',
    });
  }
}

module.exports = new AIModel();
