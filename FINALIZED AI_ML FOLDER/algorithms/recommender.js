function recommendCareers(scores) {
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([career, score]) => ({
      career,
      score
    }));
}

module.exports = recommendCareers;