import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoadmap, recommendByRules, scoreCareer } from '../src/services/recommender/ruleBased.js';
import { findMissingFields, mergeAiResult } from '../src/services/recommender/index.js';

const careers = [
  {
    id: 1, title: 'Frontend Developer', field: 'Software', description: 'UI work',
    relatedMajors: ['Computer Engineering'], interests: ['software', 'design'],
    skills: [
      { skillId: 10, name: 'JavaScript', importance: 3, minLevel: 4, learningResource: 'javascript.info' },
      { skillId: 11, name: 'React', importance: 2, minLevel: 3, learningResource: 'react.dev' },
    ],
  },
  {
    id: 2, title: 'Data Analyst', field: 'Data', description: 'Insights',
    relatedMajors: ['Statistics'], interests: ['data'],
    skills: [{ skillId: 20, name: 'SQL', importance: 3, minLevel: 3, learningResource: 'SQLBolt' }],
  },
];

const assessment = {
  major: 'computer engineering',
  interests: ['software'],
  skills: [
    { skillId: 10, name: 'JavaScript', level: 4 },
    { skillId: 11, name: 'React', level: 1 },
    { skillId: 30, name: 'Git', level: 3 },
  ],
};

test('scoreCareer rewards matching skills, interests and major', () => {
  const s = scoreCareer(assessment, careers[0]);
  assert.deepEqual(s.matchedSkills, ['JavaScript']);
  assert.equal(s.majorMatch, true);
  assert.deepEqual(s.sharedInterests, ['software']);
  assert.equal(s.gaps.length, 1);
  assert.ok(s.score > scoreCareer(assessment, careers[1]).score);
});

test('feedback ratings nudge the score', () => {
  const liked = scoreCareer(assessment, { ...careers[0], avgRating: 5 }).score;
  const disliked = scoreCareer(assessment, { ...careers[0], avgRating: 1 }).score;
  assert.ok(liked > disliked);
});

test('roadmap orders gaps by importance', () => {
  const roadmap = buildRoadmap([
    { name: 'A', importance: 1, minLevel: 3, currentLevel: 0 },
    { name: 'B', importance: 3, minLevel: 3, currentLevel: 2 },
  ]);
  assert.deepEqual(roadmap.map((r) => r.skill), ['B', 'A']);
  assert.equal(roadmap[0].priority, 'high');
});

test('recommendByRules ranks best match first', () => {
  const [first] = recommendByRules(assessment, careers);
  assert.equal(first.careerId, 1);
  assert.ok(first.explanation.includes('JavaScript'));
});

test('findMissingFields lists essential gaps', () => {
  assert.deepEqual(findMissingFields({ major: '', interests: [], skills: [] }), ['major', 'interests', 'skills (at least 3)']);
  assert.deepEqual(findMissingFields(assessment), []);
});

test('mergeAiResult drops unknown careers and fills curated data', () => {
  const rules = recommendByRules(assessment, careers);
  const raw = JSON.stringify({
    recommendations: [
      { careerId: 99, score: 90, explanation: 'hallucinated' },
      { careerId: 2, score: 140, explanation: 'Good with data' },
    ],
  });
  const merged = mergeAiResult(raw, careers, rules);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].title, 'Data Analyst');
  assert.equal(merged[0].score, 100);
  assert.ok(merged[0].roadmap.length > 0);
});

test('mergeAiResult throws when nothing is usable', () => {
  assert.throws(() => mergeAiResult('{"recommendations":[]}', careers, []));
});
