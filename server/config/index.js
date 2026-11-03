/**
 * 集中配置管理
 * 从环境变量加载所有配置项
 */
const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  apiPrefix: process.env.API_PREFIX || '/api',
  systemMode: process.env.SYSTEM_MODE || 'saas',

  app: {
    url: process.env.APP_URL || 'http://localhost:3000',
    name: process.env.APP_NAME || 'SEO工具',
    debug: process.env.APP_DEBUG === 'true',
    timezone: process.env.APP_TIMEZONE || 'Asia/Shanghai',
  },

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    database: process.env.DB_DATABASE || 'shexpatshome',
    username: process.env.DB_USERNAME || 'shexpatshome',
    password: process.env.DB_PASSWORD || 'shexpatshome',
    charset: process.env.DB_CHARSET || 'utf8mb4',
  },

  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    database: parseInt(process.env.REDIS_DATABASE, 10) || 0,
    prefix: process.env.REDIS_PREFIX || 'expatshome_node:',
  },

  session: {
    secret: process.env.SESSION_SECRET || 'expatshome_node_session_secret',
    timeout: parseInt(process.env.SESSION_TIMEOUT, 10) || 3600,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'expatshome_jwt_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  mail: {
    host: process.env.MAIL_HOST || 'smtp.qq.com',
    port: parseInt(process.env.MAIL_PORT, 10) || 587,
    username: process.env.MAIL_USERNAME || '',
    password: process.env.MAIL_PASSWORD || '',
    fromEmail: process.env.MAIL_FROM_EMAIL || 'noreply@expatshome.cn',
    fromName: process.env.MAIL_FROM_NAME || 'SEO工具',
  },

  sms: {
    provider: process.env.SMS_PROVIDER || 'smsbao',
    smsbao: {
      username: process.env.SMSBAO_USERNAME || '',
      password: process.env.SMSBAO_PASSWORD || '',
    },
    aliyun: {
      accessKey: process.env.ALIYUN_ACCESS_KEY || '',
      accessSecret: process.env.ALIYUN_ACCESS_SECRET || '',
      signName: process.env.ALIYUN_SIGN_NAME || '',
      templateCode: process.env.ALIYUN_TEMPLATE_CODE || '',
    },
  },

  payment: {
    yipay: {
      enabled: process.env.YIPAY_ENABLED === 'true',
      gatewayUrl: process.env.YIPAY_GATEWAY_URL || '',
      merchantId: process.env.YIPAY_MERCHANT_ID || '',
      merchantKey: process.env.YIPAY_MERCHANT_KEY || '',
    },
  },

  oauth: {
    rainbow: {
      enabled: process.env.RAINBOW_LOGIN_ENABLED === 'true',
      appId: process.env.RAINBOW_APP_ID || '',
      appKey: process.env.RAINBOW_APP_KEY || '',
      apiUrl: process.env.RAINBOW_API_URL || '',
    },
  },

  map: {
    amapKey: process.env.AMAP_API_KEY || '',
    baiduKey: process.env.BAIDU_MAP_KEY || '',
  },

  storage: {
    defaultDriver: process.env.STORAGE_DEFAULT || 'local',
    uploadPath: process.env.UPLOAD_PATH || 'public/uploads',
    maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE, 10) || 200,
  },

  security: {
    passwordMinLength: 8,
    loginAttemptsLimit: 5,
    lockoutDuration: 1800,
  },
};

module.exports = config;
