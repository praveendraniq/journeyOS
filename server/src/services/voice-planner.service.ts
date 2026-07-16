import type { Interest, TripRequest } from '../types.js';

const defaultRequest: TripRequest = {
  origin: undefined, destination: 'Japan', departureDate: undefined, returnDate: undefined, departureTime: undefined, duration: 5, travelers: 4, budget: 6000,
  travelStyle: 'culture-forward, unhurried', foodPreferences: ['sushi', 'vegetarian friendly'],
  interests: ['culture', 'history', 'food', 'photography'],
};

const numberWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const toNumber = (value: string) => /^\d+$/.test(value) ? Number(value) : numberWords[value.toLowerCase()] ?? 0;

const monthNumbers: Record<string, number> = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
const isoDate = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);

/**
 * Keeps the UI productive without an external model while matching the shape
 * of an eventual Vocal Bridge structured conversation response.
 */
export class VocalBridgeService {
  async extractTrip(conversation: string): Promise<{ request: TripRequest; source: 'local-parser'; confidence: number }> {
    const value = conversation.toLowerCase();
    const request = structuredClone(defaultRequest);
    const route = conversation.match(/(?:from|leaving|departing)\s+([a-z]{3}|[a-z][a-z .'-]+?)\s+(?:to|for)\s+([a-z][a-z .'-]+?)(?=\s+(?:on|for|with|under|at|this|next)|[.,]|$)/i);
    if (route) {
      request.origin = route[1].trim().length === 3 ? route[1].trim().toUpperCase() : route[1].trim().replace(/\b\w/g, (letter) => letter.toUpperCase());
      request.destination = route[2].trim().replace(/\b\w/g, (letter) => letter.toUpperCase());
    }
    const destination = value.match(/(?:to|in|visit)\s+([a-z ]+?)(?:\s+(?:for|under|with|this|next)|[.,]|$)/i)?.[1]?.trim();
    if (destination && !route) request.destination = destination.replace(/\b\w/g, (letter) => letter.toUpperCase());
    const origin = value.match(/(?:from|leaving|departing)\s+([a-z]{3})(?=\s|[.,]|$)/i)?.[1];
    if (origin) request.origin = origin.toUpperCase();
    const explicitDate = value.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
    const namedDate = value.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d{2}))?\b/);
    if (explicitDate) request.departureDate = `${explicitDate[1]}-${explicitDate[2].padStart(2, '0')}-${explicitDate[3].padStart(2, '0')}`;
    else if (namedDate) {
      const now = new Date();
      const month = monthNumbers[namedDate[1]];
      let year = namedDate[3] ? Number(namedDate[3]) : now.getFullYear();
      if (!namedDate[3] && isoDate(year, month, Number(namedDate[2])) < now.toISOString().slice(0, 10)) year += 1;
      request.departureDate = isoDate(year, month, Number(namedDate[2]));
    }
    const returnIso = value.match(/(?:return|back)\s+(?:on\s+)?(20\d{2}-\d{1,2}-\d{1,2})/);
    if (returnIso) request.returnDate = returnIso[1].replace(/-(\d)(?=-|$)/g, '-0$1');
    const time = value.match(/(?:at|around)\s+(\d{1,2}(?::\d{2})?\s*(?:a\.?(?:m)\.?|p\.?(?:m)\.?)?)/i)?.[1]?.replace(/\s+/g, ' ').trim();
    if (time) request.departureTime = time.toUpperCase();
    const duration = value.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)[ -]?day/);
    if (duration) request.duration = toNumber(duration[1]);
    const people = value.match(/(?:for|with)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:people|travelers|friends|adults)/);
    if (people) request.travelers = toNumber(people[1]);
    const budget = value.match(/(?:under|budget(?:\s+of)?|\$)\s*\$?([\d,]+)(?:k|000)?/);
    if (budget) {
      const raw = Number(budget[1].replace(/,/g, ''));
      request.budget = value.includes(`${budget[1]}k`) ? raw * 1000 : raw;
    }
    const interests: Array<[Interest, RegExp]> = [
      ['culture', /culture|temple|shrine|traditional/], ['history', /history|historic|museum/], ['food', /food|sushi|restaurant|culinary/],
      ['photography', /photo|camera|photography/], ['shopping', /shop|fashion/], ['nightlife', /nightlife|bar|club/], ['nature', /nature|hike|outdoor/],
    ];
    const extracted = interests.filter(([, pattern]) => pattern.test(value)).map(([interest]) => interest);
    if (extracted.length) request.interests = extracted;
    if (/slow|relax|easy/.test(value)) request.travelStyle = 'slow, restorative';
    if (/fast|packed|adventure/.test(value)) request.travelStyle = 'high-energy exploration';
    if (/vegetarian|vegan/.test(value)) request.foodPreferences = ['vegetarian friendly', ...request.foodPreferences.filter((food) => food !== 'vegetarian friendly')];
    return { request, source: 'local-parser', confidence: 0.94 };
  }
}
