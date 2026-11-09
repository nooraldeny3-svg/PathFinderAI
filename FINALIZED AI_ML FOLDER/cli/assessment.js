
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const calculateScores = require("../algorithms/scorer");
const recommendCareers = require("../algorithms/recommender");

const questionsDir = path.join(__dirname, "../data/questions");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function main() {
  try {
    const files = fs.readdirSync(questionsDir)
      .filter(file => file.endsWith(".json"));

    const questions = files.flatMap(file => {
      const content = JSON.parse(
        fs.readFileSync(path.join(questionsDir, file), "utf8")
      );
      if (!Array.isArray(content)) {
        throw new Error(`${file} must contain an array of questions`);
      }
      return content;
    }).sort((a, b) => a.id - b.id);

    if (questions.length !== 20) {
      throw new Error(
        `Expected 20 questions, but found ${questions.length}.`
      );
    }

    const ids = new Set(questions.map(q => q.id));
    if (ids.size !== 20) {
      throw new Error("Question IDs must be unique.");
    }

    const selectedAnswers = [];

    console.log("\nCAREER GUIDANCE ASSESSMENT — 20 QUESTIONS");
    console.log("Choose one option for each question.\n");

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      console.log(`\n${i + 1}/20. ${q.question}`);
      q.options.forEach((option, index) => {
        console.log(`  ${index + 1}. ${option.text}`);
      });

      let choice;
      while (true) {
        const input = (await ask("Enter 1-4: ")).trim();
        choice = Number(input);

        if (
          Number.isInteger(choice) &&
          choice >= 1 &&
          choice <= q.options.length
        ) {
          break;
        }
        console.log("Please enter a valid option number.");
      }

      selectedAnswers.push(q.options[choice - 1]);
    }

    const scores = calculateScores(selectedAnswers);
    const results = recommendCareers(scores);

    console.log("\nYOUR TOP 3 CAREER RECOMMENDATIONS");
    results.forEach((result, index) => {
      console.log(
        `${index + 1}. ${result.career.replace(/_/g, " ")} — Score: ${result.score}`
      );
    });

  } catch (error) {
    console.error("\nError:", error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

main();
