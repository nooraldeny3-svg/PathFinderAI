'use strict';
const calculateScores = require('./scorer');
const matchCareer = require('./careerMatcher');
const {predictWithML} = require('./mlBridge');

// Preserves the existing selected-option-object API; does not guess ML features from 20 answers.
function predictHybridCareer(answers, skills, major, careers, mlProfile, options = {}) {
  if (!Array.isArray(answers) || !Array.isArray(skills) || typeof major !== 'string' || !Array.isArray(careers)) {
    throw new TypeError('Expected answers array, skills array, major string, careers array');
  }
  const ruleScores = matchCareer({...calculateScores(answers)}, skills, major, careers);
  const ml = predictWithML(mlProfile, options);
  const mlScores = new Map(ml.topRecommendations.map(r => [r.careerId, r.modelScore]));
  const ids = new Set([...Object.keys(ruleScores), ...mlScores.keys()]);
  const maxRule = Math.max(0, ...Object.values(ruleScores));
  const mlWeight = options.mlWeight === undefined ? 0.5 : options.mlWeight;
  if (!Number.isFinite(mlWeight) || mlWeight < 0 || mlWeight > 1) throw new RangeError('mlWeight must be between 0 and 1');
  const rankings = [...ids].map(career => {
    const ruleScore = ruleScores[career] || 0;
    const ruleNormalized = maxRule ? 100 * ruleScore / maxRule : 0;
    const modelScore = mlScores.get(career) || 0;
    return {career, ruleScore, ruleNormalized: +ruleNormalized.toFixed(2), modelScore,
      hybridScore: +((1 - mlWeight) * ruleNormalized + mlWeight * modelScore).toFixed(2)};
  }).sort((a,b) => b.hybridScore-a.hybridScore || a.career.localeCompare(b.career));
  return {assessmentType:'hybrid_ml_rule_based', predictedCareer:ml.predictedCareer,
    topRecommendations:rankings.slice(0,3), rankings,
    note:'Hybrid scores are heuristic alignment measures, not validated probabilities of career success. ML requires five explicitly mapped categorical features.'};
}
module.exports = {predictHybridCareer};
