
const http = require("http");
const fs = require("fs");
const path = require("path");

const calculateScores = require("../algorithms/scorer");
const recommendCareers = require("../algorithms/recommender");
const { predictHybridCareer } = require("../algorithms/hybridCareer");
const { mapAssessmentToML } = require("../algorithms/mlProfileMapper");

const PORT = 3000;
const webDir = __dirname;
const questionsDir = path.join(__dirname, "../data/questions");

function loadQuestions() {
  const files = fs.readdirSync(questionsDir)
    .filter(file => file.endsWith(".json"));

  const questions = files.flatMap(file => {
    const data = JSON.parse(
      fs.readFileSync(path.join(questionsDir, file), "utf8")
    );
    if (!Array.isArray(data)) {
      throw new Error(`Invalid question file: ${file}`);
    }
    return data;
  });

  questions.sort((a, b) => a.id - b.id);

  if (questions.length !== 20 ||
      new Set(questions.map(q => q.id)).size !== 20) {
    throw new Error("Exactly 20 unique questions are required.");
  }

  return questions;
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(data));
}

function serveFile(res, filename, contentType) {
  fs.readFile(path.join(webDir, filename), (error, content) => {
    if (error) {
      sendJSON(res, 404, { error: "File not found." });
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/questions") {
      const questions = loadQuestions();

      const publicQuestions = questions.map(q => ({
        id: q.id,
        category: q.category,
        question: q.question,
        options: q.options.map(option => ({
          text: option.text
        }))
      }));

      return sendJSON(res, 200, publicQuestions);
    }

    if (req.method === "POST" && req.url === "/api/assess") {
      let body = "";

      for await (const chunk of req) {
        body += chunk;
        if (body.length > 100000) {
          return sendJSON(res, 413, {
            error: "Request too large."
          });
        }
      }

      const input = JSON.parse(body);
      const questions = loadQuestions();

      if (!Array.isArray(input.selections) ||
          input.selections.length !== 20) {
        return sendJSON(res, 400, {
          error: "Please answer all 20 questions."
        });
      }

      const selections = new Map();

      for (const selection of input.selections) {
        if (!selection ||
            !Number.isInteger(selection.questionId) ||
            !Number.isInteger(selection.optionIndex) ||
            selections.has(selection.questionId)) {
          return sendJSON(res, 400, {
            error: "Invalid or duplicate answer."
          });
        }
        selections.set(selection.questionId, selection.optionIndex);
      }

      const selectedAnswers = [];
      const answeredQuestions = [];

      for (const question of questions) {
        const index = selections.get(question.id);

        if (!Number.isInteger(index) ||
            index < 0 ||
            index >= question.options.length) {
          return sendJSON(res, 400, {
            error: "An answer is missing or invalid."
          });
        }

        selectedAnswers.push(question.options[index]);
        answeredQuestions.push({ category: question.category, option: question.options[index] });
      }

      // ML profile is a heuristic inferred from career tags, not a direct
      // measurement of the five categorical training features.
      const mlProfile = mapAssessmentToML(answeredQuestions);
      const hybrid = predictHybridCareer(
        selectedAnswers, [], String(input.major || ""), [], mlProfile
      );
      return sendJSON(res, 200, {
        name: String(input.name || ""),
        major: String(input.major || ""),
        recommendations: hybrid.topRecommendations.map(item => ({
          career: item.career,
          score: item.hybridScore,
          ruleScore: item.ruleScore,
          modelScore: item.modelScore
        })),
        method: hybrid.assessmentType,
        mlProfile,
        note: "ML inputs were inferred heuristically from answer career tags; hybrid scores are not validated career-success probabilities."
      });
    }

    if (req.method === "GET" &&
        (req.url === "/" || req.url === "/index.html")) {
      return serveFile(res, "index.html", "text/html; charset=utf-8");
    }

    if (req.method === "GET" && req.url === "/app.js") {
      return serveFile(res, "app.js", "text/javascript; charset=utf-8");
    }

    return sendJSON(res, 404, { error: "Not found." });

  } catch (error) {
    console.error(error);
    return sendJSON(res, 500, {
      error: "An internal server error occurred."
    });
  }
});

server.listen(PORT, () => {
  console.log(`Career Guidance System running at http://localhost:${PORT}`);
});
