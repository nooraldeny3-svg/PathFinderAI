'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const FEATURES = ['interest', 'skill', 'personality', 'workstyle', 'goal'];
function predictWithML(mlProfile, options = {}) {
  if (!mlProfile || typeof mlProfile !== 'object' || Array.isArray(mlProfile)) throw new TypeError('mlProfile must be an object');
  for (const feature of FEATURES) if (typeof mlProfile[feature] !== 'string' || !mlProfile[feature].trim()) throw new Error(`Missing ML feature: ${feature}`);
  const script = options.scriptPath || path.resolve(__dirname, '../ML/predict_model.py');
  if (!fs.existsSync(script)) throw new Error(`ML prediction script not found: ${script}`);
  const result = spawnSync(options.python || process.env.PYTHON_BIN || 'python', [script, '--json-stdin'], {
    input: JSON.stringify(Object.fromEntries(FEATURES.map(k => [k, mlProfile[k]]))),
    encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024,
    cwd: path.dirname(script), windowsHide: true
  });
  if (result.error) throw new Error(`ML process error: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`ML prediction failed: ${(result.stderr || '').trim() || `exit ${result.status}`}`);
  let prediction;
  try { prediction = JSON.parse(result.stdout); } catch { throw new Error('ML prediction returned invalid JSON'); }
  if (!Array.isArray(prediction.topRecommendations)) throw new Error('ML prediction missing recommendations');
  return prediction;
}
module.exports = {predictWithML};
