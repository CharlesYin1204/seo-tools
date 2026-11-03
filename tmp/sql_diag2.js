const { query, createPool } = require('../server/config/database');
(async () => {
  try {
    createPool();
    const tables = await query('SHOW TABLES');
    console.log('@@TABLES:' + JSON.stringify(tables.filter(row => Object.values(row)[0].includes('publisher') || Object.values(row)[0].includes('contact')).slice(0, 100)));
    const total = await query(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN community IS NOT NULL AND community != '' THEN 1 ELSE 0 END) AS nonempty_community
      FROM wechat_robot_expat_parsed_properties WHERE deleted_at IS NULL`);
    console.log('@@TOTAL:' + JSON.stringify(total));
    const t2 = Date.now();
    const cnt = await query(`SELECT COUNT(*) AS cnt
      FROM wechat_robot_expat_parsed_properties p
      WHERE p.deleted_at IS NULL
        AND p.community IS NOT NULL
        AND p.community != ''
        AND NOT EXISTS (
          SELECT 1 FROM property_community_dict pcd
          WHERE pcd.community_name = p.community AND pcd.is_enabled = 1
        )`);
    console.log('@@NOTINPOIMS:' + (Date.now() - t2));
    console.log('@@NOTINPOI:' + JSON.stringify(cnt));
  } catch (err) {
    console.error('@@ERR', err && err.stack ? err.stack : err);
  } finally {
    process.exit(0);
  }
})();
