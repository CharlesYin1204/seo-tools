const { query, createPool } = require('../server/config/database');
(async () => {
  try {
    createPool();
    const tables = ['wechat_robot_expat_parsed_properties', 'property_community_dict', 'wechat_robot_moments', 'wechat_robot_publisher_contacts'];
    for (const table of tables) {
      const rows = await query(`SHOW INDEX FROM ${table}`);
      console.log('@@INDEX:' + table + ':' + JSON.stringify(rows.slice(0, 50)));
    }
    const t1 = Date.now();
    const total = await query(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN community IS NOT NULL AND community != '' THEN 1 ELSE 0 END) AS nonempty_community
      FROM wechat_robot_expat_parsed_properties WHERE deleted_at IS NULL`);
    console.log('@@TOTALMS:' + (Date.now() - t1));
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
