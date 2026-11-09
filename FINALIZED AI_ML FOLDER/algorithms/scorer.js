function calculateScores(answers) {
  const scores = {};

  answers.forEach(answer => {
    answer.careerTags.forEach(career => {
      scores[career] = (scores[career] || 0) + answer.weight;
    });
  });

  return scores;
}

module.exports = calculateScores;