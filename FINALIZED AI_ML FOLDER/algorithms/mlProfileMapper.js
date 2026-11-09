"use strict";
const fs = require("node:fs");
const path = require("node:path");
const FEATURES = ["interest", "skill", "personality", "workstyle", "goal"];
const CSV = path.resolve(__dirname, "../ML/dataset.csv");

// Demo-only mapping: question options have careerTags, not explicit ML feature
// labels. Infer each category's dominant career, then choose a representative
// feature value from training examples of that career. This creates dependence
// between rule-based and ML results and MUST NOT be presented as validated.
function mapAssessmentToML(answeredQuestions) {
  const lines = fs.readFileSync(CSV, "utf8").trim().split(/\r?\n/);
  const headers = lines.shift().split(",").map(s => s.trim());
  for (const key of [...FEATURES, "career"]) {
    if (!headers.includes(key)) throw new Error(`Dataset missing column: ${key}`);
  }
  const rows = lines.filter(Boolean).map(line => {
    const values = line.split(",").map(s => s.trim());
    return Object.fromEntries(headers.map((key, i) => [key, values[i]]));
  });
  if (!rows.length) throw new Error("ML dataset is empty");
  const categoryFeature = {
    interests: "interest", skills: "skill", personality: "personality",
    workstyle: "workstyle", careergoals: "goal"
  };
  const result = {};
  for (const [category, feature] of Object.entries(categoryFeature)) {
    const points = new Map();
    for (const answer of answeredQuestions) {
      if (String(answer.category).replace(/[^a-z]/gi, "").toLowerCase() !== category) continue;
      for (const career of answer.option.careerTags || []) {
        points.set(career, (points.get(career) || 0) + (Number(answer.option.weight) || 0));
      }
    }
    const leading = [...points].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    const eligible = rows.filter(row => row.career === leading);
    const candidates = eligible.length ? eligible : rows;
    const counts = new Map();
    for (const row of candidates) counts.set(row[feature], (counts.get(row[feature]) || 0) + 1);
    result[feature] = [...counts].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]))[0][0];
  }
  return result;
}
module.exports = { mapAssessmentToML };
