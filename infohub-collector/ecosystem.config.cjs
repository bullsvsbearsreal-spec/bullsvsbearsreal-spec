module.exports = {
  apps: [{
    name: 'infohub-collector',
    script: 'collector.mjs',
    instances: 1,
    autorestart: true,
    max_memory_restart: '256M',
    watch: false,
    env: {
      NODE_ENV: 'production',
    },
  }],
};
