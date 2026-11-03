const ctrl = require('../server/controllers/user/WeChatRobotPluginController');
const start = Date.now();
const req = {
  user: { id: 1, role: 'admin' },
  query: {
    page: '1', per_page: '50', publish_time_start: '2026-04-17', publish_time_end: '2026-04-20',
    exclude_keywords: '合租,宿舍,收房,拿房,床位,次卧,主卧,招聘', price_min: '5000', not_in_poi: '1'
  }
};
const res = {
  statusCode: 200,
  status(c){ this.statusCode = c; return this; },
  json(payload){
    const body = payload && payload.data ? payload.data : payload;
    const dataLen = body && Array.isArray(body.data) ? body.data.length : null;
    const total = body && body.pagination ? body.pagination.total : null;
    console.log('@@RES:' + JSON.stringify({ statusCode: this.statusCode, success: payload.success, message: payload.message, dataLen, total, ms: Date.now() - start }));
    process.exit(0);
  }
};
setTimeout(() => {
  console.error('@@TIMEOUT:' + (Date.now() - start));
  process.exit(124);
}, 45000);
ctrl.getParsedProperties(req, res).catch(err => {
  console.error('@@ERR', err && err.stack ? err.stack : err);
  process.exit(1);
});
