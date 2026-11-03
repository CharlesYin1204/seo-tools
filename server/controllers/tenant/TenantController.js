const { query } = require('../../config/database');
const { success, error } = require('../../utils/response');
const logger = require('../../utils/logger');

function safeJson(value, fallback = []) {
  if (!value) return fallback;
  if (Array.isArray(value) || typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function toJson(value) {
  return JSON.stringify(Array.isArray(value) ? value : normalizeList(value));
}

function nowSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

class TenantController {
  async ensureTenantProfile(userId) {
    const rows = await query('SELECT * FROM tenant_profiles WHERE user_id = ? LIMIT 1', [userId]);
    if (rows[0]) return rows[0];

    await query('INSERT INTO tenant_profiles (user_id, created_at, updated_at) VALUES (?, NOW(), NOW())', [userId]);
    const created = await query('SELECT * FROM tenant_profiles WHERE user_id = ? LIMIT 1', [userId]);
    return created[0] || null;
  }

  async getDashboard(req, res) {
    try {
      const userId = req.user.id;
      const [profile] = await query('SELECT * FROM tenant_profiles WHERE user_id = ? LIMIT 1', [userId]);
      const [demandCount] = await query('SELECT COUNT(*) total FROM tenant_demands WHERE user_id = ?', [userId]);
      const [favoriteCount] = await query('SELECT COUNT(*) total FROM property_favorites WHERE user_id = ?', [userId]);
      const [conversationCount] = await query('SELECT COUNT(*) total FROM tenant_conversations WHERE tenant_id = ?', [userId]);
      const [appointmentCount] = await query('SELECT COUNT(*) total FROM appointments WHERE client_id = ? OR user_id = ?', [userId, userId]);
      const [applicationCount] = await query('SELECT COUNT(*) total FROM rental_applications WHERE tenant_id = ?', [userId]);
      const [contractCount] = await query('SELECT COUNT(*) total FROM rental_contracts WHERE tenant_id = ?', [userId]);
      const [billCount] = await query('SELECT COUNT(*) total FROM tenant_bills WHERE tenant_id = ? AND status IN (\'pending\', \'overdue\')', [userId]);

      const conversations = await query(
        `SELECT c.*, p.title AS property_title, u.display_name AS agent_name,
                (SELECT content FROM tenant_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message
         FROM tenant_conversations c
         LEFT JOIN properties p ON p.id = c.property_id
         LEFT JOIN users u ON u.id = c.agent_id
         WHERE c.tenant_id = ?
         ORDER BY c.updated_at DESC LIMIT 5`,
        [userId]
      );

      const appointments = await query(
        `SELECT a.*, p.title AS property_title
         FROM appointments a
         LEFT JOIN properties p ON p.id = a.property_id
         WHERE a.client_id = ? OR a.user_id = ?
         ORDER BY a.appointment_date DESC LIMIT 5`,
        [userId, userId]
      );

      return success(res, {
        profile: profile || null,
        stats: {
          demands: demandCount.total || 0,
          favorites: favoriteCount.total || 0,
          conversations: conversationCount.total || 0,
          appointments: appointmentCount.total || 0,
          applications: applicationCount.total || 0,
          contracts: contractCount.total || 0,
          pendingBills: billCount.total || 0,
        },
        recentConversations: conversations,
        upcomingAppointments: appointments,
      });
    } catch (err) {
      logger.error('获取租客仪表盘失败', { error: err.message, userId: req.user?.id });
      return error(res, '获取租客中心数据失败', 500);
    }
  }

  async getProfile(req, res) {
    try {
      const profile = await this.ensureTenantProfile(req.user.id);
      return success(res, profile);
    } catch (err) {
      return error(res, '获取租客资料失败', 500);
    }
  }

  async updateProfile(req, res) {
    try {
      await this.ensureTenantProfile(req.user.id);
      const allowed = [
        'legal_name', 'preferred_name', 'nationality', 'passport_no', 'wechat_id', 'preferred_language',
        'move_in_date', 'lease_months', 'budget_min', 'budget_max', 'preferred_districts', 'preferred_metro_lines',
        'company_or_school', 'commute_address', 'has_pet', 'occupants', 'notes',
      ];
      const data = {};
      allowed.forEach((key) => {
        if (req.body[key] !== undefined) data[key] = req.body[key];
      });
      if (data.preferred_districts !== undefined) data.preferred_districts = toJson(data.preferred_districts);
      if (data.preferred_metro_lines !== undefined) data.preferred_metro_lines = toJson(data.preferred_metro_lines);
      data.updated_at = nowSql();

      const fields = Object.keys(data);
      if (fields.length) {
        await query(
          `UPDATE tenant_profiles SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE user_id = ?`,
          [...fields.map((field) => data[field]), req.user.id]
        );
      }
      const profile = await this.ensureTenantProfile(req.user.id);
      return success(res, profile, '租客资料已保存');
    } catch (err) {
      logger.error('保存租客资料失败', { error: err.message, userId: req.user?.id });
      return error(res, '保存租客资料失败', 500);
    }
  }

  async getDemands(req, res) {
    try {
      const rows = await query('SELECT * FROM tenant_demands WHERE user_id = ? ORDER BY updated_at DESC', [req.user.id]);
      return success(res, rows.map((row) => ({ ...row, preferred_districts: safeJson(row.preferred_districts), preferred_metro_lines: safeJson(row.preferred_metro_lines), tags: safeJson(row.tags) })));
    } catch (err) {
      return error(res, '获取租房需求失败', 500);
    }
  }

  async createDemand(req, res) {
    try {
      const data = req.body || {};
      await query(
        `INSERT INTO tenant_demands
         (user_id, title, budget_min, budget_max, bedrooms, bathrooms, preferred_districts, preferred_metro_lines,
          move_in_date, lease_months, pet_allowed, occupants, tags, description, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
        [
          req.user.id,
          data.title || '我的租房需求',
          data.budget_min || null,
          data.budget_max || null,
          data.bedrooms || null,
          data.bathrooms || null,
          toJson(data.preferred_districts),
          toJson(data.preferred_metro_lines),
          data.move_in_date || null,
          data.lease_months || null,
          data.pet_allowed ? 1 : 0,
          data.occupants || 1,
          toJson(data.tags),
          data.description || '',
        ]
      );
      return this.getDemands(req, res);
    } catch (err) {
      return error(res, '新增租房需求失败', 500);
    }
  }

  async updateDemand(req, res) {
    try {
      const id = Number(req.params.id);
      const data = req.body || {};
      await query(
        `UPDATE tenant_demands SET title = ?, budget_min = ?, budget_max = ?, bedrooms = ?, bathrooms = ?,
         preferred_districts = ?, preferred_metro_lines = ?, move_in_date = ?, lease_months = ?, pet_allowed = ?,
         occupants = ?, tags = ?, description = ?, status = ?, updated_at = NOW()
         WHERE id = ? AND user_id = ?`,
        [
          data.title || '我的租房需求', data.budget_min || null, data.budget_max || null, data.bedrooms || null,
          data.bathrooms || null, toJson(data.preferred_districts), toJson(data.preferred_metro_lines),
          data.move_in_date || null, data.lease_months || null, data.pet_allowed ? 1 : 0, data.occupants || 1,
          toJson(data.tags), data.description || '', data.status || 'active', id, req.user.id,
        ]
      );
      return this.getDemands(req, res);
    } catch (err) {
      return error(res, '更新租房需求失败', 500);
    }
  }

  async deleteDemand(req, res) {
    try {
      await query('DELETE FROM tenant_demands WHERE id = ? AND user_id = ?', [Number(req.params.id), req.user.id]);
      return success(res, null, '租房需求已删除');
    } catch (err) {
      return error(res, '删除租房需求失败', 500);
    }
  }

  async getFavorites(req, res) {
    try {
      const rows = await query(
        `SELECT f.id AS favorite_id, f.created_at AS favorited_at, p.*
         FROM property_favorites f
         INNER JOIN properties p ON p.id = f.property_id
         WHERE f.user_id = ?
         ORDER BY f.created_at DESC`,
        [req.user.id]
      );
      return success(res, rows.map((row) => ({ ...row, images: safeJson(row.images) })));
    } catch (err) {
      return error(res, '获取收藏房源失败', 500);
    }
  }

  async addFavorite(req, res) {
    try {
      const propertyId = Number(req.body.property_id || req.params.propertyId);
      if (!propertyId) return error(res, '缺少房源ID');
      await query('INSERT IGNORE INTO property_favorites (property_id, user_id, created_at) VALUES (?, ?, NOW())', [propertyId, req.user.id]);
      return success(res, null, '已收藏房源');
    } catch (err) {
      return error(res, '收藏房源失败', 500);
    }
  }

  async removeFavorite(req, res) {
    try {
      await query('DELETE FROM property_favorites WHERE property_id = ? AND user_id = ?', [Number(req.params.propertyId), req.user.id]);
      return success(res, null, '已取消收藏');
    } catch (err) {
      return error(res, '取消收藏失败', 500);
    }
  }

  async getConversations(req, res) {
    try {
      const rows = await query(
        `SELECT c.*, p.title AS property_title, u.display_name AS agent_name,
                (SELECT content FROM tenant_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
                (SELECT created_at FROM tenant_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message_at
         FROM tenant_conversations c
         LEFT JOIN properties p ON p.id = c.property_id
         LEFT JOIN users u ON u.id = c.agent_id
         WHERE c.tenant_id = ?
         ORDER BY COALESCE(last_message_at, c.updated_at) DESC`,
        [req.user.id]
      );
      return success(res, rows);
    } catch (err) {
      return error(res, '获取站内沟通失败', 500);
    }
  }

  async createConversation(req, res) {
    try {
      const propertyId = Number(req.body.property_id || 0) || null;
      const agentId = Number(req.body.agent_id || 0) || null;
      const source = req.body.source || 'tenant_center';
      const subject = req.body.subject || '租房咨询';
      const initialMessage = req.body.message || '';

      let property = null;
      if (propertyId) {
        const propertyRows = await query('SELECT id, user_id, agent_id, title FROM properties WHERE id = ? LIMIT 1', [propertyId]);
        property = propertyRows[0] || null;
      }
      const finalAgentId = agentId || property?.agent_id || property?.user_id || null;

      const existing = propertyId
        ? await query('SELECT * FROM tenant_conversations WHERE tenant_id = ? AND property_id = ? AND status != \'closed\' LIMIT 1', [req.user.id, propertyId])
        : [];
      let conversationId = existing[0]?.id;

      if (!conversationId) {
        const result = await query(
          `INSERT INTO tenant_conversations (tenant_id, agent_id, property_id, source, subject, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'open', NOW(), NOW())`,
          [req.user.id, finalAgentId, propertyId, source, subject]
        );
        conversationId = result.insertId;
      }

      if (initialMessage) {
        await query(
          `INSERT INTO tenant_messages (conversation_id, sender_id, sender_role, message_type, content, created_at)
           VALUES (?, ?, 'tenant', 'text', ?, NOW())`,
          [conversationId, req.user.id, initialMessage]
        );
        await query('UPDATE tenant_conversations SET updated_at = NOW() WHERE id = ?', [conversationId]);
      }

      return success(res, { id: conversationId }, '已创建站内咨询');
    } catch (err) {
      logger.error('创建租客会话失败', { error: err.message, userId: req.user?.id });
      return error(res, '创建站内咨询失败', 500);
    }
  }

  async getMessages(req, res) {
    try {
      const conversationId = Number(req.params.id);
      const [conversation] = await query('SELECT id FROM tenant_conversations WHERE id = ? AND tenant_id = ? LIMIT 1', [conversationId, req.user.id]);
      if (!conversation) return error(res, '会话不存在', 404);
      const rows = await query('SELECT * FROM tenant_messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC', [conversationId]);
      return success(res, rows.map((row) => ({ ...row, attachments: safeJson(row.attachments) })));
    } catch (err) {
      return error(res, '获取消息失败', 500);
    }
  }

  async sendMessage(req, res) {
    try {
      const conversationId = Number(req.params.id);
      const content = String(req.body.content || '').trim();
      if (!content) return error(res, '请输入消息内容');
      const [conversation] = await query('SELECT id FROM tenant_conversations WHERE id = ? AND tenant_id = ? LIMIT 1', [conversationId, req.user.id]);
      if (!conversation) return error(res, '会话不存在', 404);
      await query(
        `INSERT INTO tenant_messages (conversation_id, sender_id, sender_role, message_type, content, created_at)
         VALUES (?, ?, 'tenant', 'text', ?, NOW())`,
        [conversationId, req.user.id, content]
      );
      await query('UPDATE tenant_conversations SET updated_at = NOW() WHERE id = ?', [conversationId]);
      return this.getMessages(req, res);
    } catch (err) {
      return error(res, '发送消息失败', 500);
    }
  }

  async getAppointments(req, res) {
    try {
      const rows = await query(
        `SELECT a.*, p.title AS property_title, p.address AS property_address
         FROM appointments a
         LEFT JOIN properties p ON p.id = a.property_id
         WHERE a.client_id = ? OR a.user_id = ?
         ORDER BY a.appointment_date DESC`,
        [req.user.id, req.user.id]
      );
      return success(res, rows);
    } catch (err) {
      return error(res, '获取预约失败', 500);
    }
  }

  async createAppointment(req, res) {
    try {
      const data = req.body || {};
      const propertyId = Number(data.property_id || 0);
      if (!propertyId || !data.appointment_date) return error(res, '请选择房源和看房时间');
      const [property] = await query('SELECT id, user_id, agent_id FROM properties WHERE id = ? LIMIT 1', [propertyId]);
      if (!property) return error(res, '房源不存在', 404);
      const agentId = property.agent_id || property.user_id;
      await query(
        `INSERT INTO appointments (user_id, property_id, agent_id, client_id, client_name, client_phone, client_email, wechat, appointment_date, status, notes, requirements, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, NOW(), NOW())`,
        [
          req.user.id, propertyId, agentId, req.user.id,
          data.client_name || req.user.display_name || req.user.username,
          data.client_phone || req.user.phone || '', data.client_email || req.user.email || '',
          data.wechat || '', data.appointment_date, data.notes || '', data.requirements || '',
        ]
      );
      return this.getAppointments(req, res);
    } catch (err) {
      return error(res, '创建看房预约失败', 500);
    }
  }

  async listTable(req, res, table, whereField = 'tenant_id') {
    try {
      const rows = await query(`SELECT * FROM ${table} WHERE ${whereField} = ? ORDER BY updated_at DESC, id DESC`, [req.user.id]);
      return success(res, rows);
    } catch (err) {
      return error(res, '获取数据失败', 500);
    }
  }

  getApplications(req, res) { return this.listTable(req, res, 'rental_applications'); }
  getContracts(req, res) { return this.listTable(req, res, 'rental_contracts'); }
  getBills(req, res) { return this.listTable(req, res, 'tenant_bills'); }
  getDocuments(req, res) { return this.listTable(req, res, 'tenant_documents'); }
  getServiceTickets(req, res) { return this.listTable(req, res, 'tenant_service_tickets'); }
}

module.exports = new TenantController();
