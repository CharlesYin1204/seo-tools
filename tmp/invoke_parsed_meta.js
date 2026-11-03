const ctrl = require('../server/controllers/user/WeChatRobotPluginController');
async function run(name, method, query) {
  const start = Date.now();
  return await new Promise((resolve, reject) => {
    const req = { user: { id: 1, role: 'admin' }, query };
    const res = {
      statusCode: 200,
      status(c){ this.statusCode = c; return this; },
      json(payload){
        console.log('@@' + name + ':' + JSON.stringify({ statusCode: this.statusCode, success: payload.success, message: payload.message, ms: Date.now() - start, keys: payload.data ? Object.keys(payload.data) : [] }).slice(0, 1000));
        resolve();
      }
    };
    Promise.resolve(ctrl[method](req, res)).catch(reject);
  });
}
(async () => {
  try {
    await run('stats', 'getParsedPropertyStats', {});
    await run('filters', 'getParsedPropertyFilters', {});
    process.exit(0);
  } catch (err) {
    console.error('@@ERR', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
