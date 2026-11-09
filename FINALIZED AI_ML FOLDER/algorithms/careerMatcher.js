function matchCareer(scores, userSkills, userMajor, careers) {

  
function normalize(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

function matchCareer(scores, userSkills, userMajor, careers) {
  const result = { ...scores };

  for (const career of careers) {
    const careerId = career.careerId || career.id;
    if (!careerId) continue;

    result[careerId] = result[careerId] || 0;

    const majors = career.recommendedMajors || career.relatedMajors || [];

    if (
      userMajor &&
      majors.some(major => normalize(major) === normalize(userMajor))
    ) {
      result[careerId] += 15;
    }

    const requiredSkills = career.requiredSkills || [];

    for (const skill of requiredSkills) {
      if (userSkills.some(s => normalize(s) === normalize(skill))) {
        result[careerId] += 5;
      }
    }
  }

  return result;
}

module.exports = matchCareer;
}
