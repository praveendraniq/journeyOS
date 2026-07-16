import { config } from '../config.js';

export class LandingAiService {
  async analyzeReceipt(input: { fileName?: string; amount?: number; restaurant?: string }) {
    if (!config.mockMode && config.landingAi.endpoint && config.landingAi.apiKey) {
      const response = await fetch(config.landingAi.endpoint, { method: 'POST', headers: { Authorization: `Bearer ${config.landingAi.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (!response.ok) throw new Error(`Landing AI returned ${response.status}`);
      return response.json();
    }
    return { restaurant: input.restaurant ?? 'Sushi Dai', amount: input.amount ?? 120, currency: 'USD', confidence: 0.98, source: 'mock-landing-ai' };
  }
}
