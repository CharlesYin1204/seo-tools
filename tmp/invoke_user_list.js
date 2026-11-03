const ctrl = require('../server/controllers/user/WeChatRobotPluginController');
async function call(user, query) {
  const start = Date.now();
  return await new Promise((resolve, reject) => {
    const req = { user, query };
    const res = { statusCode: 200, status(c){this.statusCode=c; return this;}, json(payload){
      const body = payload && payload.data ? payload.data : payload;
      const dataLen = body && Array.isArray(body.data) ? body.data.length : null;
      const total = body && body.pagination ? body.pagination.total : null;
      console.log('@@RES:' + JSON.stringify({ user, statusCode: this.statusCode, success: payload.success, message: payload.message, dataLen, total, ms: Date.now()-start }));
      resolve();
    }};
    Promise.resolve(ctrl.getParsedProperties(req, res)).catch(reject);
  });
}
(async () => {
  try {
    const q = { page:'1', per_page:'50', publish_time_start:'2026-04-18', publish_time_end:'2026-04-21', exclude_keywords:'合租,宿舍,收房,拿房,床位,次卧,主卧,招聘', price_min:'5000', property_only:'1', deduplicate:'1' };
    await call({ id: 1, role: 'admin' }, q);
    await call({ id: 1, role: 'user' }, q);
    process.exit(0);
  } catch (err) {
    console.error('@@ERR', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
