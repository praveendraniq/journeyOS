import { createApp } from './app.js';
import { config } from './config.js';

createApp().listen(config.port, () => {
  console.log(`JourneyOS API listening on http://localhost:${config.port} (${config.mockMode ? 'mock' : 'live'} mode)`);
});
