import { HeartHandshake, Sparkles } from 'lucide-react';
import type { Interest, Trip } from '../types';

const interests: Interest[] = ['culture', 'history', 'food', 'photography', 'shopping', 'nightlife', 'nature'];
const mood = (score?: number) => score === undefined
  ? { face: '\u2728', label: 'Still learning', tone: 'bg-stone-100 text-stone-600' }
  : score >= 88
    ? { face: '\u{1F604}', label: 'Delighted', tone: 'bg-emerald-100 text-emerald-800' }
    : score >= 78
      ? { face: '\u{1F642}', label: 'Feels good', tone: 'bg-lime-100 text-lime-800' }
      : score >= 68
        ? { face: '\u{1F60C}', label: 'Balanced', tone: 'bg-amber-100 text-amber-800' }
        : { face: '\u{1F914}', label: 'Needs a trade', tone: 'bg-rose-100 text-rose-800' };

export function TravelerFitOverview({ trip }: { trip: Trip }) {
  const calls = new Map((trip.preferenceCollection?.calls ?? []).map((call) => [call.travelerId, call]));
  const groupMood = mood(trip.groupPreference.groupHappiness);
  return <section className="overflow-hidden rounded-[30px] border border-stone-200 bg-white">
    <div className="grid gap-5 bg-gradient-to-br from-[#eff6f1] via-white to-[#fff2ed] p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="eyebrow text-moss">Group vibe</p><h2 className="mt-1 text-2xl font-bold text-ink">Does this plan feel good for everyone?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">A human-readable snapshot of protected priorities, pace, food needs, and the compromises people accepted.</p></div><div className={`flex items-center gap-4 rounded-3xl px-5 py-4 ${groupMood.tone}`}><span className="text-4xl" aria-hidden="true">{groupMood.face}</span><div><p className="text-xs font-bold uppercase tracking-wider">{groupMood.label}</p><p className="mt-1 text-2xl font-bold">{trip.groupPreference.groupHappiness === undefined ? 'Learning' : `${trip.groupPreference.groupHappiness}% group fit`}</p>{trip.groupPreference.fairnessGap !== undefined && <p className="mt-1 text-xs opacity-75">Only {trip.groupPreference.fairnessGap} points between highest and lowest fit</p>}</div></div></div>
    <div className="grid gap-3 p-5 sm:p-7 lg:grid-cols-2">{trip.travelers.map((traveler) => {
      const call = calls.get(traveler.id);
      const top = interests.slice().sort((left, right) => traveler.interests[right] - traveler.interests[left]).slice(0, 3);
      const avoids = interests.slice().sort((left, right) => traveler.interests[left] - traveler.interests[right]).slice(0, 1);
      const personMood = mood(call?.happiness);
      return <article key={traveler.id} className="rounded-3xl border border-stone-200 bg-[#fafbf9] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-ink text-xs font-bold text-white">{traveler.initials}</span><div><p className="font-bold text-ink">{traveler.name}</p><p className="text-xs capitalize text-stone-500">{traveler.pacePreference} pace · {traveler.foodPreference}</p></div></div><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${personMood.tone}`}><span className="text-base" aria-hidden="true">{personMood.face}</span>{call ? `${call.happiness}% plan fit` : 'Preference call pending'}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><p className="text-[10px] font-bold uppercase tracking-wider text-moss">Would love</p><div className="mt-2 flex flex-wrap gap-1.5">{top.map((interest) => <span key={interest} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold capitalize text-moss">{interest}</span>)}</div></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-coral">Keep light</p><div className="mt-2 flex flex-wrap gap-1.5">{avoids.map((interest) => <span key={interest} className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold capitalize text-coral">{interest}</span>)}</div></div></div>{call ? <div className="mt-4 rounded-2xl bg-white p-3 text-xs leading-5 text-stone-600 ring-1 ring-stone-100"><b className="text-ink">Why this works:</b> {call.happinessExplanation || call.compromise}</div> : <p className="mt-4 text-xs leading-5 text-stone-500">JourneyOS will replace this estimate with their real call outcome and accepted trade.</p>}</article>;
    })}</div>
    <div className="mx-5 mb-5 flex flex-col gap-3 rounded-2xl bg-ink p-4 text-white sm:mx-7 sm:mb-7 sm:flex-row sm:items-center"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10"><HeartHandshake className="text-emerald-200" size={20} /></span><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-emerald-200">The fair trade</p><p className="mt-1 text-sm leading-6 text-white/75">{trip.groupPreference.explanation}</p></div><Sparkles className="ml-auto hidden shrink-0 text-amber-200 sm:block" /></div>
  </section>;
}
