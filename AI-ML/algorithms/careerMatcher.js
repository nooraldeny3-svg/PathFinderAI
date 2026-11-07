function matchCareer(scores, userSkills, userMajor, careers) {

  careers.forEach(career => {

    if (!scores[career.id]) {
      scores[career.id] = 0;
    }

    if (
      career.relatedMajors &&
      career.relatedMajors.includes(userMajor)
    ) {
      scores[career.id] += 15;
    }

    if (career.requiredSkills) {
      career.requiredSkills.forEach(skill => {

        if (userSkills.includes(skill)) {
          scores[career.id] += 5;
        }

      });
    }

  });

  return scores;
}

module.exports = matchCareer;