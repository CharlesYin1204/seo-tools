/**
 * PM2 生态系统配置文件
 * SEO工具 Node.js 应用部署配置
 */
module.exports = {
  apps: [
    {
      name: 'seo-tools',
      script: './server/app.js',
      cwd: __dirname,
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      autorestart: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
      node_args: '--max-old-space-size=512',
    },
  ],
};
