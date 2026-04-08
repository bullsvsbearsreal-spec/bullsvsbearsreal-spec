module.exports = {
  apps: [{
    name: 'infohub-funding-bot',
    script: 'node_modules/.bin/tsx',
    args: 'bot.ts',
    instances: 1,
    autorestart: true,
    max_memory_restart: '512M',
    watch: false,
    env: {
      NODE_ENV: 'production',
    },
  }],
};
