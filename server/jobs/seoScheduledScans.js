const { query } = require('../config/database');
const SeoWorkspaceController = require('../controllers/user/SeoWorkspaceController');
const logger = require('../utils/logger');
let running = false;
async function runSeoScheduledScans() {
  if (running) return; running = true;
  try {
    const sites = await query(`SELECT s.id,o.owner_user_id,u.username,u.role FROM seo_sites s JOIN organizations o ON o.id=s.organization_id JOIN users u ON u.id=o.owner_user_id WHERE s.status='active' AND s.ownership_status='verified' AND s.auto_scan_enabled=1 AND s.next_scan_at IS NOT NULL AND s.next_scan_at<=NOW() LIMIT 5`);
    for (const site of sites) {
      const req={params:{id:site.id},body:{},user:{id:site.owner_user_id,username:site.username,role:site.role||'user'},ip:'127.0.0.1'}; let status=500;
      const res={status(code){status=code;return this;},json(){return this;}};
      try{await SeoWorkspaceController.scanSite(req,res)}catch(err){logger.warn('定时 SEO 扫描异常',{site_id:site.id,error:err.message})}
      await query(status>=400?'UPDATE seo_sites SET next_scan_at=DATE_ADD(NOW(),INTERVAL 1 HOUR) WHERE id=?':"UPDATE seo_sites s JOIN organizations o ON o.id=s.organization_id SET s.next_scan_at=DATE_ADD(NOW(),INTERVAL GREATEST(1,CAST(JSON_UNQUOTE(JSON_EXTRACT(o.entitlements,'$.scan_interval_hours')) AS UNSIGNED)) HOUR) WHERE s.id=?",[site.id]).catch(()=>{});
    }
  } catch(err){logger.warn('定时 SEO 扫描任务失败',{error:err.message})} finally{running=false}
}
module.exports={runSeoScheduledScans};
