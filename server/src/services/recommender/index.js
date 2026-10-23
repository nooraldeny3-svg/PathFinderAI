import { createHash } from 'node:crypto';
import { config } from '../../config.js';
import { askAi, isAiEnabled } from './aiProvider.js';
import { recommendByRules } from './ruleBased.js';

const SHORTLIST_SIZE = 8;
const MIN_SKILLS = 3;
const cache = new Map();

export function findMissingFields(assessment) {
  const missing = [];
  if (!assessment.major) missing.push('major');
  if (!assessment.interests.length) missing.push('interests');
  if (assessment.skills.length < MIN_SKILLS) missing.push(`skills (at least ${MIN_SKILLS})`);
  return missing;
}

function cacheKey(assessment) {
  const stable = {
    major: assessment.major,
    interests: [...assessment.interests].sort(),
    skills: assessment.skills.map((s) => [s.skillId, s.level]).sort((a, b) => a[0] - b[0]),
  };
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

// Keeps only AI suggestions that point at shortlisted careers, and fills in
// title/field/description and missing roadmaps from the curated data.
export function mergeAiResult(raw, shortlist, ruleResults) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const items = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];
  const byId = new Map(shortlist.map((c) => [c.id, c]));
  const rulesById = new Map(ruleResults.map((r) => [r.careerId, r]));

  const merged = [];
  for (const item of items) {
    const careerId = Number(item.careerId);
    const career = byId.get(careerId);
    if (!career || merged.some((m) => m.careerId === careerId)) continue;
    const rules = rulesById.get(careerId);
    const score = Number(item.score);
    merged.push({
      careerId,
      title: career.title,
      field: career.field,
      description: career.description,
      score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : rules?.score ?? 0,
      explanation: String(item.explanation || rules?.explanation || ''),
      matchedSkills: rules?.matchedSkills ?? [],
      roadmap: Array.isArray(item.roadmap) && item.roadmap.length
        ? item.roadmap.slice(0, 8).map((r) => ({
          skill: String(r.skill || ''),
          priority: ['high', 'medium', 'low'].includes(r.priority) ? r.priority : 'medium',
          step: String(r.step || ''),
        }))
        : rules?.roadmap ?? [],
    });
    if (merged.length === 5) break;
  }
  if (!merged.length) throw new Error('AI response contained no usable recommendations');
  return merged;
}

export async function recommend(assessment, careers) {
  const ruleResults = recommendByRules(assessment, careers, SHORTLIST_SIZE);
  const rulesOnly = { source: 'rules', recommendations: ruleResults.slice(0, 5) };

  if (!isAiEnabled()) return rulesOnly;

  const key = cacheKey(assessment);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const shortlistIds = new Set(ruleResults.map((r) => r.careerId));
  const shortlist = careers.filter((c) => shortlistIds.has(c.id));
  try {
    const raw = await askAi(assessment, shortlist);
    const value = { source: 'ai', recommendations: mergeAiResult(raw, shortlist, ruleResults) };
    cache.set(key, { value, expires: Date.now() + config.ai.cacheTtlMs });
    return value;
  } catch (err) {
    console.warn(`AI recommendation failed, using rule-based fallback: ${err.message}`);
    return { ...rulesOnly, notice: 'The AI service was unavailable, so these results come from our rule-based engine.' };
  }
}
