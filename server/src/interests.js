// Fixed vocabulary for career interests, shared by assessment, careers and the engine.
export const INTERESTS = [
  { id: 'software', label: 'Building software' },
  { id: 'data', label: 'Working with data' },
  { id: 'ai', label: 'Artificial intelligence' },
  { id: 'design', label: 'Design & user experience' },
  { id: 'security', label: 'Cybersecurity' },
  { id: 'infrastructure', label: 'Cloud & infrastructure' },
  { id: 'business', label: 'Business & strategy' },
  { id: 'management', label: 'Leading projects & teams' },
  { id: 'communication', label: 'Communication & marketing' },
  { id: 'research', label: 'Research' },
  { id: 'quality', label: 'Quality & testing' },
];

export const INTEREST_IDS = new Set(INTERESTS.map((i) => i.id));
