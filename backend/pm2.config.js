module.exports = {
  apps: [
    {
      name: 'docrule-backend',
      script: 'server.js',
      cwd: __dirname,

      // Run 1 instance (change to 'max' to use all CPU cores)
      instances: 1,
      exec_mode: 'fork',

      // Environment
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },

      // Auto-restart settings
      autorestart: true,
      watch: false,          // don't watch files in production
      max_memory_restart: '500M', // restart if it exceeds 500MB RAM

      // Logging
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    }
  ]
};
