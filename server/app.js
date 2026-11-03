/**
 * ExpatHome Node.js 应用入口
 * Express服务器配置和启动
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const logger = require('./utils/logger');
const { createPool, testConnection } = require('./config/database');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const registerRoutes = require('./routes');

const app = express();

const healthResponse = (req, res) => res.json({ ok: true, service: 'seo-ai', port: config.port, time: new Date().toISOString() });
app.get('/healthz', healthResponse);
app.get('/api/healthz', healthResponse);

app.set('trust proxy', 1);

// 安全头
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS配置（允许Vue.js前端跨域请求）
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:8080',
    'https://sh.expatshome.cn',
    'https://sh.expatshome.cn:8088',
    'http://171.80.1.159:8088',
    process.env.APP_URL,
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-App-Id', 'X-Api-Key'],
}));

// 请求体解析 - 微信支付回调需要原始XML文本
app.use('/api/payment/notify/wechat', express.text({ type: ['text/xml', 'application/xml', 'text/*'], limit: '1mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(compression());

// Session配置
const sessionConfig = {
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: config.session.timeout * 1000,
    sameSite: 'lax',
  },
};

// Production sessions must survive process restarts. Redis remains optional;
// MySQL is the durable fallback because it is already a required dependency.
if (config.env === 'production') {
  if (String(process.env.REDIS_SESSION_ENABLED || '').toLowerCase() === 'true') {
    try {
      const RedisStore = require('connect-redis').default;
      const { createRedisClient } = require('./config/redis');
      sessionConfig.store = new RedisStore({ client: createRedisClient() });
    } catch (err) {
      logger.warn('Redis Session存储初始化失败，回退到MySQL', { error: err.message });
    }
  }

  if (!sessionConfig.store) {
    const MySQLStore = require('express-mysql-session')(session);
    sessionConfig.store = new MySQLStore({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USERNAME || 'shexpatshome',
      password: process.env.DB_PASSWORD || 'shexpatshome',
      database: process.env.DB_DATABASE || 'shexpatshome',
      createDatabaseTable: true,
      expiration: config.session.timeout * 1000,
      clearExpired: true,
      checkExpirationInterval: 15 * 60 * 1000,
      schema: {
        tableName: 'app_sessions',
        columnNames: { session_id: 'session_id', expires: 'expires', data: 'data' },
      },
    });
    logger.info('Session已使用MySQL持久化存储');
  }
}

app.use(session(sessionConfig));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: '请求过于频繁，请稍后再试' },
});
app.use('/api/', limiter);

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));
app.use('/assets', express.static(path.join(__dirname, '..', 'public', 'assets')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// Vue.js前端（生产环境）
// Use an explicit project-root path in production so sibling deployments cannot be served accidentally.
const clientDistPath = path.resolve(__dirname, '..', 'client', 'dist');
app.use((req, res, next) => {
  if (req.path === '/' && req.method === 'GET') {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
  }
  next();
});
// Canonical SPA entry for this deployment; keep it explicit to prevent sibling app fallbacks.
app.get('/', (req, res, next) => {
  if (req.method === 'GET' && (req.headers.accept || '').includes('text/html')) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    return res.sendFile(path.join(clientDistPath, 'index.html'));
  }
  next();
});
app.use(express.static(clientDistPath));

// 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn('慢请求', { method: req.method, path: req.path, duration: `${duration}ms`, status: res.statusCode });
    }
  });
  next();
});

// SEO路由（在API路由之前）
app.get('/sitemap.xml', async (req, res) => {
  try {
    const SeoService = require('./services/SeoService');
    const xml = await SeoService.generateSitemap();
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    res.status(500).send('Sitemap generation failed');
  }
});
app.get('/robots.txt', async (req, res) => {
  try {
    const SeoService = require('./services/SeoService');
    const txt = await SeoService.getRobotsTxt();
    res.set('Content-Type', 'text/plain');
    res.send(txt);
  } catch (err) {
    res.send('User-agent: *\nAllow: /');
  }
});

// Vue SPA 优先中间件：客户端路由路径的浏览器导航请求直接返回 index.html
// 必须在 API 路由注册之前，否则 requireAdmin 等中间件会先拦截返回 JSON
const fs = require('fs');
const spaIndexPath = path.join(clientDistPath, 'index.html');
const serveSpaShell = (req, res, next) => {
  const accepts = req.headers.accept || '';
  if (req.method === 'GET' && accepts.includes('text/html') && !req.xhr) {
    if (fs.existsSync(spaIndexPath)) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      return res.sendFile(spaIndexPath);
    }
  }
  next();
};
['/admin', '/open-api-admin', '/auth', '/user', '/tenant', '/agent', '/landlord', '/payment'].forEach(prefix => {
  app.use(prefix, serveSpaShell);
});

// 注册API路由
registerRoutes(app);

// Vue.js SPA路由回退（所有未匹配路由返回index.html）
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  const accepts = req.headers.accept || '';
  if (req.method === 'GET' && accepts.includes('text/html')) {
    if (fs.existsSync(spaIndexPath)) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      return res.sendFile(spaIndexPath);
    }
  }
  next();
});

// 404处理
app.use(notFoundHandler);

// 全局错误处理
app.use(errorHandler);

// 启动服务器
async function startServer() {
  try {
    createPool();
    const connected = await testConnection();
    if (!connected) {
      logger.error('数据库连接失败，请检查配置');
      process.exit(1);
    }

    const fs = require('fs');
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const PORT = config.port;
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`ExpatHome Node.js服务器已启动`, {
        port: PORT,
        env: config.env,
        mode: config.systemMode,
        url: `http://localhost:${PORT}`,
      });
      console.log(`\n🚀 ExpatHome Node.js服务器运行中: http://localhost:${PORT}`);
      console.log(`📦 环境: ${config.env} | 模式: ${config.systemMode}`);
      console.log(`💾 数据库: ${config.db.database}@${config.db.host}\n`);

      // 定时修复（仅一个worker执行）
      const workerId = process.env.NODE_APP_INSTANCE || process.env.pm_id || '0';
      if (String(workerId) === '0') {
        const { fixMetroLinesJob } = require('./jobs/fixMetroLines');
        setInterval(fixMetroLinesJob, 30 * 1000);
        setTimeout(fixMetroLinesJob, 3000);

        const { fixMomentIdsJob } = require('./jobs/fixMomentIds');
        setInterval(fixMomentIdsJob, 60 * 1000);
        setTimeout(fixMomentIdsJob, 5000);

        // 自动AI解析不完整房源（每60秒执行，批量+并发由system_settings配置控制）
        const { autoReparseIncompleteJob } = require('./jobs/autoReparseIncomplete');
        setInterval(autoReparseIncompleteJob, 60 * 1000);
        setTimeout(autoReparseIncompleteJob, 15 * 1000);

        // 自动刷新朋友圈（每60秒检查一次是否需要刷新）
        const { autoRefreshMomentsJob } = require('./jobs/autoRefreshMoments');
        setInterval(autoRefreshMomentsJob, 60 * 1000);
        setTimeout(autoRefreshMomentsJob, 10 * 1000);

        // 自动POI补全已禁用：新小区需人工判定导入，不再自动创建POI记录
        // const { autoEnrichPOIJob } = require('./jobs/autoEnrichPOI');
        // setInterval(autoEnrichPOIJob, 10 * 60 * 1000);
        // setTimeout(autoEnrichPOIJob, 60 * 1000);

        // 涉外房源定时搜索任务（对应PHP版 processExpatPropertyScheduledTasks，每分钟检查）
        const { expatScheduledTasksJob } = require('./jobs/expatScheduledTasks');
        setInterval(expatScheduledTasksJob, 60 * 1000);
        setTimeout(expatScheduledTasksJob, 15 * 1000);
        const { runSeoScheduledScans } = require('./jobs/seoScheduledScans');
        setInterval(runSeoScheduledScans, 60 * 1000);
        setTimeout(runSeoScheduledScans, 20 * 1000);

        const { cleanupExpiredMomentData } = require('./services/MomentRetentionService');
        setInterval(() => cleanupExpiredMomentData().catch(() => {}), 6 * 60 * 60 * 1000);
        setTimeout(() => cleanupExpiredMomentData().catch(() => {}), 20 * 1000);

        console.log('[定时任务] 数据一致性修复+自动重解析+朋友圈自动刷新+涉外房源定时搜索+SEO定时扫描已启动 (worker ' + workerId + ')');
      }
    });
  } catch (err) {
    logger.error('服务器启动失败', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', async () => {
  logger.info('收到SIGTERM信号，正在关闭...');
  const { closePool } = require('./config/database');
  await closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('收到SIGINT信号，正在关闭...');
  const { closePool } = require('./config/database');
  await closePool();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise拒绝', { reason: reason?.message || reason });
});

startServer();

module.exports = app;
