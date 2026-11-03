const { query } = require('./server/config/database');
function tag(xml, name) {
  const m = String(xml || '').match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? m[1].replace(/&amp;/g, '&').slice(0, 300) : '';
}
(async () => {
  const favs = await query("SELECT fav_id,type,LEFT(content,1200) content FROM wechat_robot_favorites WHERE robot_id=45 AND type=18 AND fav_id IN (2505,2504,2503,2502,2501,2500,2499,2288) ORDER BY fav_id DESC");
  const keys = [];
  for (const f of favs) {
    const sourceid = tag(f.content, 'sourceid');
    const eventid = tag(f.content, 'eventid');
    const sourcename = tag(f.content, 'sourcename');
    const fromusr = tag(f.content, 'fromusr');
    const realchatname = tag(f.content, 'realchatname');
    console.log(JSON.stringify({ fav_id:f.fav_id, sourceid, eventid, sourcename, fromusr, realchatname }, null, 2));
    for (const s of [sourceid, eventid]) String(s||'').split('#').forEach(x=>{ if (/^\d+$/.test(x)) keys.push(x); });
  }
  const uniq = [...new Set(keys)];
  console.log('numeric keys', uniq);
  if (uniq.length) {
    const rows = await query(`SELECT moment_id,wxid,nickname,LEFT(content,80) content,LEFT(media_list,300) media_list,created_at FROM wechat_robot_moments WHERE robot_id=45 AND moment_id IN (${uniq.map(()=>'?').join(',')})`, uniq);
    console.log('moment exact rows', JSON.stringify(rows, null, 2));
  }
  const sampleMoments = await query("SELECT moment_id,wxid,nickname,LEFT(content,120) content,LEFT(media_list,300) media_list,created_at FROM wechat_robot_moments WHERE robot_id=45 AND media_list IS NOT NULL AND media_list != '[]' ORDER BY created_at DESC LIMIT 10");
  console.log('sample moments with media', JSON.stringify(sampleMoments, null, 2));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
