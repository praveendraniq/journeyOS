/** Canonical seeded profile used everywhere Friend 1 appears in the demo. */
export const PRABHU_PROFILE = {
  travelerId: 't-prabhu',
  pace: 'Moderate walking',
  food: 'Pescetarian food',
  mustDo: 'Early dinner',
  priorities: ['Early dinner', 'Moderate walking', 'Pescetarian food'],
  keepLight: 'Late nights',
  summary: 'Prabhu prefers an early dinner, moderate walking, and pescetarian food.',
  compromise: 'Schedule a shared early dinner, then make any late-night activity optional.',
  happiness: 82,
} as const;

export const isPrabhuProfile = (travelerId: string) => travelerId === PRABHU_PROFILE.travelerId;
