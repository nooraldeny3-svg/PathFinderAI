import { createApp } from './app.js';
import { config } from './config.js';

createApp().listen(config.port, () => {
  console.log(`PathFinder AI API listening on http://localhost:${config.port} (AI provider: ${config.ai.provider})`);
});
