import { CheckCircle2, MessageCircleMore, Scale } from 'lucide-react';
import type { Trip } from '../types';

export function NegotiationReplay({ trip }: { trip: Trip }) {
  const collection = trip.preferenceCollection;
  const calls = collection?.calls.filter((call) => call.status === 'completed' && call.dialogue?.length) ?? [];
  if (!collection || !calls.length) return null;

  return <section className="mt-6 overflow-hidden rounded-[30px] border border-coral/20 bg-[#fff8e9]">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-coral/15 px-5 py-5 sm:px-6">
      <div><p className="eyebrow text-coral">Conflict mediation replay</p><h2 className="mt-1 text-2xl font-bold text-ink">Watch the AI offer a fair trade.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">JourneyOS names the conflict, protects each person's must-do, asks for agreement, and records the accepted compromise for the admin.</p></div>
      <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${collection.source === 'vocal-bridge' ? 'bg-emerald-100 text-moss' : 'bg-white text-stone-600 ring-1 ring-stone-200'}`}>{collection.source === 'vocal-bridge' ? 'Live Vocal Bridge calls' : 'Scripted demo · no calls placed'}</span>
    </div>
    <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-2">{calls.map((call) => <article key={call.travelerId} className="rounded-2xl bg-white p-4 ring-1 ring-coral/10"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><MessageCircleMore size={18} className="text-coral" /><b className="text-ink">Mediator + {call.name}</b></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-moss">{call.happiness}% plan fit</span></div><div className="mt-4 space-y-2">{call.dialogue?.map((line, index) => <div key={`${line.speaker}-${index}`} className={`rounded-xl px-3 py-2.5 text-xs leading-5 ${line.speaker === 'agent' ? 'mr-5 bg-ink text-white' : 'ml-5 bg-[#eff6f1] text-ink'}`}><b className={line.speaker === 'agent' ? 'text-emerald-200' : 'text-moss'}>{line.speaker === 'agent' ? 'AI mediator' : call.name}:</b> {line.text}</div>)}</div><div className="mt-4 flex items-start gap-2 rounded-xl bg-[#fff8e9] p-3 text-xs leading-5 text-stone-700"><Scale size={15} className="mt-0.5 shrink-0 text-coral" /><span><b className="text-ink">Recorded compromise:</b> {call.compromise}</span></div></article>)}</div>
    <div className="mx-5 mb-5 flex items-center gap-2 rounded-xl bg-moss px-4 py-3 text-xs font-semibold text-white sm:mx-6 sm:mb-6"><CheckCircle2 size={16} className="shrink-0" />The admin still approves the final priority weights before the itinerary changes.</div>
  </section>;
}
