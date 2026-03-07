module.exports = {
  apps: [{
    name: 'liq-ingester',
    script: 'workers/liquidation-ingester.ts',
    interpreter: 'npx',
    interpreter_args: 'tsx',
    env: {
      NODE_ENV: 'production',
    },
    max_memory_restart: '256M',
    restart_delay: 5000,
    max_restarts: 50,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
