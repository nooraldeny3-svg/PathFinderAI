// Creates the schema and loads the curated career/skill data. Safe to re-run.
import { readFile } from 'node:fs/promises';
import { pool, withTransaction } from '../src/db.js';

const read = (rel) => readFile(new URL(rel, import.meta.url), 'utf8');

const schema = await read('../db/schema.sql');
const skills = JSON.parse(await read('../data/skills.json'));
const careers = JSON.parse(await read('../data/careers.json'));

try {
  await pool.query(schema);
  await withTransaction(async (client) => {
    const skillIds = new Map();
    for (const s of skills) {
      const { rows } = await client.query(
        `INSERT INTO skills (name, category, learning_resource) VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category, learning_resource = EXCLUDED.learning_resource
         RETURNING id`,
        [s.name, s.category, s.learning_resource],
      );
      skillIds.set(s.name, rows[0].id);
    }

    for (const c of careers) {
      const { rows } = await client.query(
        `INSERT INTO careers (slug, title, description, field, related_majors, interests)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description,
           field = EXCLUDED.field, related_majors = EXCLUDED.related_majors, interests = EXCLUDED.interests
         RETURNING id`,
        [c.slug, c.title, c.description, c.field, c.related_majors, c.interests],
      );
      const careerId = rows[0].id;
      await client.query('DELETE FROM career_skills WHERE career_id = $1', [careerId]);
      for (const req of c.skills) {
        const skillId = skillIds.get(req.name);
        if (!skillId) throw new Error(`Career "${c.slug}" references unknown skill "${req.name}"`);
        await client.query(
          'INSERT INTO career_skills (career_id, skill_id, importance, min_level) VALUES ($1, $2, $3, $4)',
          [careerId, skillId, req.importance, req.min_level],
        );
      }
    }
  });
  console.log(`Database ready: ${skills.length} skills, ${careers.length} careers.`);
} finally {
  await pool.end();
}
