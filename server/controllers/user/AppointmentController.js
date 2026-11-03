/**
 * 用户端预约控制器
 * 预约列表、创建、更新、取消
 */
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');

class AppointmentController {
  async getAppointments(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, pageSize = 20, status = '' } = req.query;
      let sql =
        'SELECT a.*, p.title as property_title, p.address FROM appointments a LEFT JOIN properties p ON a.property_id = p.id WHERE a.user_id = ?';
      const params = [userId];
      if (status) {
        sql += ' AND a.status = ?';
        params.push(status);
      }
      const countSql = sql.replace(/SELECT a\.\*.*?FROM/, 'SELECT COUNT(*) as total FROM');
      const [countResult] = await query(countSql, params);
      const total = countResult ? countResult.total : 0;
      sql += ' ORDER BY a.appointment_date DESC LIMIT ? OFFSET ?';
      params.push(parseInt(pageSize, 10), (parseInt(page, 10) - 1) * parseInt(pageSize, 10));
      const data = await query(sql, params);
      return paginated(res, data, total, parseInt(page, 10), parseInt(pageSize, 10));
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async createAppointment(req, res) {
    try {
      const userId = req.user.id;
      const { propertyId, appointmentTime, contactName, contactPhone, note } = req.body;
      if (!propertyId || !appointmentTime || !contactPhone) {
        return error(res, '请填写预约时间和联系方式', 400);
      }
      await query(
        'INSERT INTO appointments (user_id, property_id, appointment_date, client_name, client_phone, notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
        [userId, propertyId, appointmentTime, contactName || '', contactPhone, note || '', 'pending']
      );
      const [row] = await query(
        'SELECT a.*, p.title as property_title FROM appointments a LEFT JOIN properties p ON a.property_id = p.id WHERE a.user_id = ? ORDER BY a.id DESC LIMIT 1',
        [userId]
      );
      return success(res, row, '预约成功', 201);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async updateAppointment(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { appointmentTime, contactName, contactPhone, note } = req.body;
      const [existing] = await query('SELECT * FROM appointments WHERE id = ? AND user_id = ?', [id, userId]);
      if (!existing) {
        return error(res, '预约不存在或无权限', 404);
      }
      if (existing.status === 'cancelled') {
        return error(res, '已取消的预约不能修改', 400);
      }
      const updates = [];
      const params = [];
      if (appointmentTime) {
        updates.push('appointment_date = ?');
        params.push(appointmentTime);
      }
      if (contactName !== undefined) {
        updates.push('client_name = ?');
        params.push(contactName);
      }
      if (contactPhone !== undefined) {
        updates.push('client_phone = ?');
        params.push(contactPhone);
      }
      if (note !== undefined) {
        updates.push('notes = ?');
        params.push(note);
      }
      if (updates.length === 0) {
        return success(res, existing, '无变更');
      }
      params.push(id);
      await query(`UPDATE appointments SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
      const [row] = await query('SELECT * FROM appointments WHERE id = ?', [id]);
      return success(res, row, '更新成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }

  async cancelAppointment(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const [existing] = await query('SELECT * FROM appointments WHERE id = ? AND user_id = ?', [id, userId]);
      if (!existing) {
        return error(res, '预约不存在或无权限', 404);
      }
      await query("UPDATE appointments SET status = 'cancelled', updated_at = NOW() WHERE id = ? AND user_id = ?", [
        id,
        userId,
      ]);
      return success(res, null, '取消成功');
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new AppointmentController();
