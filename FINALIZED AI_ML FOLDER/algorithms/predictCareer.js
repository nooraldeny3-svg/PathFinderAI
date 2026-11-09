const calculateScores = require('./scorer');
const recommendCareers = require('./recommender');
const matchCareer = require('./careerMatcher');

function predictCareer(
  answers,
  skills,
  major,
  careers
) {

  let scores = calculateScores(answers);

  scores = matchCareer(
    scores,
    skills,
    major,
    careers
  );

  return recommendCareers(scores);
}

module.exports = predictCareer;