module.exports = {
  apps: [
    {
      name: 'payphone-ollama-tts',
      cwd: '/Users/jack/clawd/projects/payphone-ollama-tts',
      script: './scripts/start_prod.sh',
      interpreter: '/bin/bash',
      env: {
        WEB_PORT: '5173',
        // OLLAMA_BASE_URL etc are loaded from .env by the start script
      },
      autorestart: true,
      max_restarts: 50,
      restart_delay: 1000,
      kill_timeout: 5000,
    },
  ],
}
