// Deterministic scoring against curated career/skill data. Used on its own when no
// AI provider is configured, to shortlist careers for the AI, and as the fallback.

const WEIGHTS = { skills: 0.65, interests: 0.2, major: 0.15 };
const FEEDBACK_WEIGHT = 0.05;

const normalize = (s) => String(s || '').trim().toLowerCase();

export function scoreCareer(assessment, career) {
  const levels = new Map(assessment.skills.map((s) => [s.skillId, s.level]));

  let weighted = 0;
  let totalImportance = 0;
  const matchedSkills = [];
  const gaps = [];
  for (const req of career.skills) {
    const level = levels.get(req.skillId) ?? 0;
    weighted += req.importance * Math.min(level / req.minLevel, 1);
    totalImportance += req.importance;
    if (level >= req.minLevel) matchedSkills.push(req.name);
    else gaps.push({ ...req, currentLevel: level });
  }
  const skillScore = totalImportance ? weighted / totalImportance : 0;

  const sharedInterests = career.interests.filter((i) => assessment.interests.includes(i));
  const interestScore = career.interests.length ? sharedInterests.length / career.interests.length : 0;

  const majorMatch = career.relatedMajors.some((m) => normalize(m) === normalize(assessment.major));

  // Average user feedback (1–5) nudges the score by at most ±FEEDBACK_WEIGHT.
  const feedbackAdjust = career.avgRating ? ((career.avgRating - 3) / 2) * FEEDBACK_WEIGHT : 0;

  const raw = WEIGHTS.skills * skillScore + WEIGHTS.interests * interestScore + WEIGHTS.major * (majorMatch ? 1 : 0);
  const score = Math.round(Math.max(0, Math.min(1, raw + feedbackAdjust)) * 100);

  return { score, skillScore, matchedSkills, sharedInterests, majorMatch, gaps };
}

export function buildRoadmap(gaps) {
  return [...gaps]
    .sort((a, b) => b.importance - a.importance || (b.minLevel - b.currentLevel) - (a.minLevel - a.currentLevel))
    .map((g) => ({
      skill: g.name,
      currentLevel: g.currentLevel,
      targetLevel: g.minLevel,
      priority: g.importance === 3 ? 'high' : g.importance === 2 ? 'medium' : 'low',
      step: g.learningResource || `Practise ${g.name} through a small project`,
    }));
}

function explain(career, s) {
  const parts = [];
  if (s.matchedSkills.length) parts.push(`You already meet the expected level in ${s.matchedSkills.join(', ')}.`);
  if (s.sharedInterests.length) parts.push(`It fits your interest in ${s.sharedInterests.join(', ')}.`);
  if (s.majorMatch) parts.push(`Your major is a common background for ${career.title} roles.`);
  if (s.gaps.length) parts.push(`Closing ${s.gaps.length} skill gap${s.gaps.length > 1 ? 's' : ''} would make you a stronger candidate.`);
  return parts.join(' ') || `${career.title} is a possible direction, but your profile has few matching skills yet.`;
}

export function recommendByRules(assessment, careers, limit = 5) {
  return careers
    .map((career) => {
      const s = scoreCareer(assessment, career);
      return {
        careerId: career.id,
        title: career.title,
        field: career.field,
        description: career.description,
        score: s.score,
        explanation: explain(career, s),
        matchedSkills: s.matchedSkills,
        roadmap: buildRoadmap(s.gaps),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
