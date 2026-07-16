import type { ItineraryItem } from '../types.js';

const minutes = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
};

const distance = (a: ItineraryItem, b: ItineraryItem) => Math.hypot(a.location.x - b.location.x, a.location.y - b.location.y);

/** A small nearest-neighbor optimizer with time-window safety checks for the demo. */
export class RouteOptimizer {
  optimize(items: ItineraryItem[], options: { raining?: boolean } = {}): ItineraryItem[] {
    const byDay = new Map<number, ItineraryItem[]>();
    for (const item of items) byDay.set(item.day, [...(byDay.get(item.day) ?? []), item]);
    return [...byDay.entries()].flatMap(([, dayItems]) => {
      const pending = [...dayItems];
      const output: ItineraryItem[] = [];
      let current = pending.shift();
      if (current) output.push(current);
      while (pending.length && current) {
        const weatherSafe = pending.filter((item) => !(options.raining && item.weatherSensitive));
        const candidates = weatherSafe.length ? weatherSafe : pending;
        const next = candidates.sort((a, b) => {
          const travelA = distance(current!, a) + Math.max(0, minutes(a.time) - minutes(current!.time) - current!.durationMins) / 120;
          const travelB = distance(current!, b) + Math.max(0, minutes(b.time) - minutes(current!.time) - current!.durationMins) / 120;
          return travelA - travelB;
        })[0];
        pending.splice(pending.indexOf(next), 1);
        output.push(next);
        current = next;
      }
      return output;
    });
  }
}
