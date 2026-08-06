// PM2 process definition for the web app.
//
// The API carries its own config in its own repo. Both register into the single
// PM2 daemon on the instance, so anything here must name only
// `govmeeting-web` — a deploy that runs `pm2 reload all` would bounce the API
// too.
module.exports = {
  apps: [
    {
      name: 'govmeeting-web',
      // Resolved against this file, so `pm2 start` works from any directory.
      cwd: __dirname,
      script: 'node_modules/.bin/next',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        // How `next start` picks its port. The API takes 4000.
        PORT: 3000,
        // Read at runtime by src/lib/api-base.ts, where server components call
        // the API directly. The browser-side /api/:path* rewrite in
        // next.config.ts resolves this at build time instead, so setting it
        // here does not affect that.
        INTERNAL_API_URL: 'http://127.0.0.1:4000',
      },
      error_file: 'logs/web-error.log',
      out_file: 'logs/web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: false,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      listen_timeout: 30000,
      kill_timeout: 5000,
    },
  ],
};
