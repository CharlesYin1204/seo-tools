/**
 * 经纪人预约控制器
 */
const { success, error, paginated } = require('../../utils/response');
const { query } = require('../../config/database');

class AppointmentController {
  async getAppointments(req, res) {
    try {
      const agentId = req.user.id;
      const { page = 1, pageSize = 20, status = '' } = req.query;
      let sql = `SELECT a.*, p.title as property_title, p.address FROM appointments a 
        INNER JOIN properties p ON a.property_id = p.id 
        WHERE p.user_id = ?`;
      const params = [agentId];
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
      const agentId = req.user.id;
      const { propertyId, appointmentTime, contactName, contactPhone, note } = req.body;
      if (!propertyId || !appointmentTime || !contactPhone) {
        return error(res, '请填写预约时间和联系方式', 400);
      }
      const [property] = await query('SELECT * FROM properties WHERE id = ? AND user_id = ?', [propertyId, agentId]);
      if (!property) {
        return error(res, '房源不存在或无权限', 404);
      }
      await query(
        'INSERT INTO appointments (user_id, property_id, appointment_date, client_name, client_phone, notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
        [0, propertyId, appointmentTime, contactName || '', contactPhone, note || '', 'pending']
      );
      const [row] = await query(
        'SELECT a.*, p.title as property_title FROM appointments a LEFT JOIN properties p ON a.property_id = p.id ORDER BY a.id DESC LIMIT 1'
      );
      return success(res, row, '预约成功', 201);
    } catch (err) {
      return error(res, err.message, 500);
    }
  }
}

module.exports = new AppointmentController();
