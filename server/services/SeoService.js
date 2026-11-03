/** 生成 SEO工具自身的 Sitemap 与 robots.txt。 */
const { query } = require('../config/database');
const logger = require('../utils/logger');

const siteUrl = () => String(process.env.SITE_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const escapeXml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

class SeoService {
  async generateSitemap() {
    const base = siteUrl();
    const urls = [
      { loc: base, changefreq: 'weekly', priority: '1.0' },
      { loc: `${base}/blog`, changefreq: 'daily', priority: '0.7' },
    ];
    try {
      const articles = await query("SELECT slug,updated_at FROM articles WHERE status='published' ORDER BY updated_at DESC LIMIT 2000");
      for (const article of articles) {
        if (!article.slug) continue;
        urls.push({ loc: `${base}/blog/${encodeURIComponent(article.slug)}`, lastmod: new Date(article.updated_at).toISOString().slice(0, 10), changefreq: 'monthly', priority: '0.6' });
      }
    } catch (error) {
      logger.warn('文章 Sitemap 查询失败，将输出基础页面', { error: error.message });
    }
    const body = urls.map((url) => [
      '  <url>', `    <loc>${escapeXml(url.loc)}</loc>`,
      url.lastmod ? `    <lastmod>${url.lastmod}</lastmod>` : '',
      `    <changefreq>${url.changefreq}</changefreq>`, `    <priority>${url.priority}</priority>`, '  </url>',
    ].filter(Boolean).join('\n')).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
  }

  getRobotsTxt() {
    return ['User-agent: *', 'Allow: /', 'Disallow: /admin/', 'Disallow: /api/', 'Disallow: /user/', '', `Sitemap: ${siteUrl()}/sitemap.xml`].join('\n');
  }
}

module.exports = new SeoService();
