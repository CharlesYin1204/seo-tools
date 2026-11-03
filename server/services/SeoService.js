/**
 * SEO 服务
 * 生成 Sitemap、robots.txt 和页面 Meta 标签
 */
const { query } = require('../config/database');
const logger = require('../utils/logger');

const SITE_URL = process.env.SITE_URL || 'https://sh.expatshome.cn';

class SeoService {
  /**
   * 生成 Sitemap XML
   * @returns {Promise<string>} XML 格式的 sitemap
   */
  async generateSitemap() {
    try {
      const urls = [];

      urls.push({ loc: SITE_URL, changefreq: 'daily', priority: '1.0' });
      urls.push({ loc: `${SITE_URL}/properties`, changefreq: 'daily', priority: '0.9' });
      urls.push({ loc: `${SITE_URL}/articles`, changefreq: 'daily', priority: '0.8' });

      const properties = await this._safeQuery(
        `SELECT id, updated_at FROM properties WHERE status = 'active' ORDER BY updated_at DESC LIMIT 5000`
      );
      for (const p of properties) {
        urls.push({
          loc: `${SITE_URL}/property/${p.id}`,
          lastmod: this._formatDate(p.updated_at),
          changefreq: 'weekly',
          priority: '0.7',
        });
      }

      const articles = await this._safeQuery(
        `SELECT id, slug, updated_at FROM articles WHERE status = 'published' ORDER BY updated_at DESC LIMIT 2000`
      );
      for (const a of articles) {
        const path = a.slug ? `/article/${a.slug}` : `/article/${a.id}`;
        urls.push({
          loc: `${SITE_URL}${path}`,
          lastmod: this._formatDate(a.updated_at),
          changefreq: 'monthly',
          priority: '0.6',
        });
      }

      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      for (const u of urls) {
        xml += '  <url>\n';
        xml += `    <loc>${this._escapeXml(u.loc)}</loc>\n`;
        if (u.lastmod) xml += `    <lastmod>${u.lastmod}</lastmod>\n`;
        if (u.changefreq) xml += `    <changefreq>${u.changefreq}</changefreq>\n`;
        if (u.priority) xml += `    <priority>${u.priority}</priority>\n`;
        xml += '  </url>\n';
      }
      xml += '</urlset>';

      logger.info('SeoService.generateSitemap 生成完毕', { urlCount: urls.length });
      return xml;
    } catch (error) {
      logger.error('SeoService.generateSitemap 失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 获取 robots.txt 内容
   * @returns {string}
   */
  getRobotsTxt() {
    return [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin/',
      'Disallow: /api/',
      'Disallow: /user/settings',
      '',
      `Sitemap: ${SITE_URL}/sitemap.xml`,
    ].join('\n');
  }

  /**
   * 获取页面 Meta 标签
   * @param {string} pageType - 页面类型 (home|property|article|list)
   * @param {number|string|null} id - 资源ID
   * @returns {Promise<{ title: string, description: string, keywords: string, ogImage?: string }>}
   */
  async getMetaTags(pageType, id = null) {
    try {
      switch (pageType) {
        case 'home':
          return {
            title: 'ExpatsHome Shanghai - Find Your Ideal Home in Shanghai',
            description: 'ExpatsHome helps expats find apartments, houses and serviced apartments for rent in Shanghai. Browse thousands of verified listings.',
            keywords: 'Shanghai apartments, expat housing, rent Shanghai, expat home',
          };

        case 'property':
          return await this._getPropertyMeta(id);

        case 'article':
          return await this._getArticleMeta(id);

        case 'list':
          return {
            title: 'Property Listings - ExpatsHome Shanghai',
            description: 'Browse all available rental properties in Shanghai. Filter by district, price, bedrooms and more.',
            keywords: 'Shanghai rental listings, apartments for rent, Shanghai properties',
          };

        default:
          return {
            title: 'ExpatsHome Shanghai',
            description: 'Find your ideal home in Shanghai with ExpatsHome.',
            keywords: 'Shanghai, expat, housing, rental',
          };
      }
    } catch (error) {
      logger.error('SeoService.getMetaTags 失败', { pageType, id, error: error.message });
      return {
        title: 'ExpatsHome Shanghai',
        description: 'Find your ideal home in Shanghai.',
        keywords: 'Shanghai, housing, rental',
      };
    }
  }

  async _getPropertyMeta(id) {
    if (!id) return this.getMetaTags('list');
    const rows = await this._safeQuery(
      'SELECT title, district, price, bedrooms, description FROM properties WHERE id = ? LIMIT 1',
      [id]
    );
    const p = rows[0];
    if (!p) return this.getMetaTags('list');

    const title = `${p.title || 'Property'} - ${p.district || 'Shanghai'} | ExpatsHome`;
    const desc = p.description
      ? p.description.substring(0, 160).replace(/[\n\r]+/g, ' ')
      : `${p.bedrooms || ''}BR apartment in ${p.district || 'Shanghai'} for ¥${p.price || ''}/month`;

    return {
      title,
      description: desc,
      keywords: `${p.district || ''}, Shanghai rental, ${p.bedrooms || ''}bedroom, apartment`,
    };
  }

  async _getArticleMeta(id) {
    if (!id) return this.getMetaTags('home');
    const field = /^\d+$/.test(String(id)) ? 'id' : 'slug';
    const rows = await this._safeQuery(
      `SELECT title, summary, cover_image FROM articles WHERE ${field} = ? LIMIT 1`,
      [id]
    );
    const a = rows[0];
    if (!a) return this.getMetaTags('home');

    return {
      title: `${a.title || 'Article'} | ExpatsHome`,
      description: (a.summary || '').substring(0, 160),
      keywords: 'Shanghai expat life, Shanghai guide',
      ogImage: a.cover_image || undefined,
    };
  }

  _formatDate(dateStr) {
    if (!dateStr) return undefined;
    try {
      const d = new Date(dateStr);
      return d.toISOString().split('T')[0];
    } catch {
      return undefined;
    }
  }

  _escapeXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  async _safeQuery(sql, params = []) {
    try {
      return await query(sql, params);
    } catch (error) {
      logger.warn('SeoService._safeQuery 查询失败', { sql: sql.substring(0, 80), error: error.message });
      return [];
    }
  }
}

module.exports = new SeoService();
