import { useEffect, useMemo, useRef, useState } from 'react';
import type { ItineraryItem, Trip } from '../types';

type GoogleRuntime = { maps: any };
let mapsLoader: Promise<GoogleRuntime> | null = null;
const loadMaps = (key: string) => {
  const existing = (window as unknown as { google?: GoogleRuntime }).google;
  if (existing?.maps) return Promise.resolve(existing);
  if (mapsLoader) return mapsLoader;
  mapsLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.dataset.journeyosGoogleMaps = 'true'; script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async`;
    script.onload = () => resolve((window as unknown as { google: GoogleRuntime }).google);
    script.onerror = () => reject(new Error('Google Maps could not load.'));
    document.head.appendChild(script);
  });
  return mapsLoader;
};

export function GoogleDayMap({ trip, activeDay, onSelect }: { trip: Trip; activeDay: number; onSelect: (item: ItineraryItem) => void }) {
  const container = useRef<HTMLDivElement | null>(null);
  const [fallback, setFallback] = useState(false);
  const [summary, setSummary] = useState('Placing today’s stops…');
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
  const selectedHotel = trip.hotels.find((hotel) => hotel.selected) ?? trip.hotels[0];
  const stops = useMemo(() => trip.itinerary.filter((item) => item.day === activeDay).sort((a, b) => a.time.localeCompare(b.time)), [activeDay, trip.itinerary]);
  const locationFor = (item: ItineraryItem) => {
    if (item.category === 'stay') return [selectedHotel?.name, selectedHotel?.location, trip.request.destination].filter(Boolean).join(', ');
    const label = item.subtitle.replace(/\s*·\s*/g, ', ').replace(/\s*→\s*/g, ' to ');
    if (label.toLowerCase().includes(trip.request.destination.toLowerCase())) return `${item.title}, ${label}`;
    return `${item.title}, ${label}, ${trip.request.destination}`;
  };
  useEffect(() => {
    let canceled = false; setFallback(false); setSummary('Placing today’s stops…');
    const useFallback = () => { setFallback(true); setSummary(`${stops.length} planned stops · showing the Google route preview`); };
    const timer = window.setTimeout(() => { if (!canceled) useFallback(); }, 4500);
    void loadMaps(key).then(async ({ maps }) => {
      if (canceled || !container.current) return;
      const geocoder = new maps.Geocoder();
      const located = (await Promise.all(stops.map((stop) => new Promise<any>((resolve) => geocoder.geocode({ address: locationFor(stop) }, (results: any[], status: string) => resolve(status === 'OK' ? { stop, location: results?.[0]?.geometry?.location } : null)))))).filter(Boolean);
      if (canceled || !located.length) { useFallback(); return; }
      window.clearTimeout(timer);
      const map = new maps.Map(container.current, { center: located[0].location, zoom: 12, mapTypeControl: false, streetViewControl: false });
      const bounds = new maps.LatLngBounds();
      located.forEach(({ stop, location }: any, index: number) => { bounds.extend(location); const marker = new maps.Marker({ map, position: location, label: { text: String(index + 1), color: '#fff' }, title: stop.title }); marker.addListener('click', () => onSelect(stop)); });
      map.fitBounds(bounds, 60);
      if (located.length > 1) new maps.DirectionsService().route({ origin: located[0].location, destination: located[located.length - 1].location, waypoints: located.slice(1, -1).map((entry: any) => ({ location: entry.location, stopover: true })), travelMode: maps.TravelMode.DRIVING }, (result: any, status: string) => { if (status === 'OK') new maps.DirectionsRenderer({ map, directions: result, suppressMarkers: true, polylineOptions: { strokeColor: '#245B4F', strokeWeight: 5 } }); });
      setSummary(`${located.length} mapped stops · Day ${activeDay}`);
    }).catch(useFallback);
    return () => { canceled = true; window.clearTimeout(timer); };
  }, [activeDay, key, selectedHotel?.id, stops, trip.request.destination]);
  const locations = stops.map(locationFor);
  const embed = locations.length > 1 ? `https://www.google.com/maps/embed/v1/directions?key=${encodeURIComponent(key)}&origin=${encodeURIComponent(locations[0])}&destination=${encodeURIComponent(locations[locations.length - 1])}&waypoints=${encodeURIComponent(locations.slice(1, -1).join('|'))}&mode=driving` : `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(locations[0] ?? trip.request.destination)}`;
  return <section className="overflow-hidden rounded-[28px] border border-stone-200 bg-white"><div className="px-5 py-4"><p className="eyebrow">Google day route</p><h3 className="mt-1 text-lg font-bold">Day {activeDay} · {trip.request.destination}</h3><p className="mt-1 text-xs text-stone-500">{summary}</p></div>{fallback ? <iframe key={`${activeDay}-${embed}`} src={embed} title={`Day ${activeDay} route`} className="h-[430px] w-full border-0" allowFullScreen /> : <div ref={container} className="h-[430px] w-full bg-[#e9f0ec]" />}<div className="grid gap-2 border-t border-stone-100 p-4 sm:grid-cols-2 lg:grid-cols-3">{stops.map((stop, index) => <button key={stop.id} onClick={() => onSelect(stop)} className="flex min-w-0 items-center gap-2 rounded-xl p-2 text-left text-xs hover:bg-stone-50"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-moss font-bold text-white">{index + 1}</span><span className="truncate"><b>{stop.time}</b> · {stop.title}</span></button>)}</div></section>;
}
