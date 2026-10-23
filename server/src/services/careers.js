import { query } from '../db.js';

// Careers with their required skills, in the shape the recommendation engine expects.
export async function loadCareers() {
  const { rows } = await query(`
    SELECT c.id, c.slug, c.title, c.description, c.field, c.related_majors, c.interests,
           COALESCE(json_agg(json_build_object(
             'skillId', s.id, 'name', s.name, 'importance', cs.importance,
             'minLevel', cs.min_level, 'learningResource', s.learning_resource
           ) ORDER BY cs.importance DESC, s.name) FILTER (WHERE s.id IS NOT NULL), '[]') AS skills,
           (SELECT AVG(f.rating)::float FROM feedback f WHERE f.career_id = c.id) AS avg_rating
    FROM careers c
    LEFT JOIN career_skills cs ON cs.career_id = c.id
    LEFT JOIN skills s ON s.id = cs.skill_id
    GROUP BY c.id
    ORDER BY c.title`);
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    field: r.field,
    relatedMajors: r.related_majors,
    interests: r.interests,
    skills: r.skills,
    avgRating: r.avg_rating,
  }));
}

// The user's assessment: profile fields plus self-rated skills.
export async function loadAssessment(userId) {
  const profile = await query('SELECT major, graduation_year, interests FROM profiles WHERE user_id = $1', [userId]);
  const skills = await query(
    `SELECT s.id AS "skillId", s.name, us.level
     FROM user_skills us JOIN skills s ON s.id = us.skill_id
     WHERE us.user_id = $1 ORDER BY s.name`,
    [userId],
  );
  const p = profile.rows[0];
  return {
    major: p?.major ?? null,
    graduationYear: p?.graduation_year ?? null,
    interests: p?.interests ?? [],
    skills: skills.rows,
  };
}
