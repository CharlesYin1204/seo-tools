const ctrl = require('/www/wwwroot/expatshomenode/server/controllers/user/WeChatRobotPluginController');
function makeRes(tag) {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { console.log('@@RESULT:' + tag + ':' + JSON.stringify({ statusCode: this.statusCode, payload }).slice(0, 4000)); return payload; }
  };
}
(async () => {
  const req = {
    user: { id: 1, role: 'admin' },
    query: {
      page: '1',
      per_page: '50',
      time_range: '3',
      publish_time_start: '2026-04-17',
      publish_time_end: '2026-04-20',
      exclude_keywords: '合租,宿舍,收房,拿房,床位,次卧,主卧,招聘',
      price_min: '5000',
      price_max: '',
      bedrooms: '',
      district: '',
      outdoor_features: '',
      metro_lines: '',
      metro_stations: '',
      publisher: '',
      parse_status: '',
      content_type: '',
      property_only: '0',
      not_in_poi: '1'
    }
  };
  try {
    await ctrl.getParsedProperties(req, makeRes('list'));
  } catch (err) {
    console.error('@@ERR', err && err.stack ? err.stack : err);
  }
})();
