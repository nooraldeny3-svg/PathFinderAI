
let questions = [];
let answers = [];
let currentQuestion = 0;
let studentName = "";
let studentMajor = "";

const $ = id => document.getElementById(id);

function showSection(sectionId) {
  ["welcome", "assessment", "results"].forEach(id => {
    $(id).classList.toggle("hidden", id !== sectionId);
  });
}

function showMessage(message) {
  $("message").textContent = message;
}

async function startAssessment() {
  studentName = $("studentName").value.trim();
  studentMajor = $("studentMajor").value.trim();

  if (!studentName || !studentMajor) {
    showMessage("Please enter your name and university major.");
    return;
  }

  showMessage("");
  $("startBtn").disabled = true;

  try {
    const response = await fetch("/api/questions");

    if (!response.ok) {
      throw new Error("Unable to load assessment questions.");
    }

    questions = await response.json();

    if (!Array.isArray(questions) || questions.length !== 20) {
      throw new Error("The assessment must contain exactly 20 questions.");
    }

    answers = Array(questions.length).fill(null);
    currentQuestion = 0;

    showSection("assessment");
    renderQuestion();
  } catch (error) {
    showMessage(error.message);
  } finally {
    $("startBtn").disabled = false;
  }
}

function renderQuestion() {
  const question = questions[currentQuestion];

  $("counter").textContent =
    `Question ${currentQuestion + 1} of ${questions.length}`;

  $("progressBar").style.width =
    `${((currentQuestion + 1) / questions.length) * 100}%`;

  $("questionText").textContent = question.question;

  const container = $("options");
  container.replaceChildren();

  question.options.forEach((option, index) => {
    const label = document.createElement("label");
    label.className = "option";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "answer";
    radio.value = String(index);
    radio.checked = answers[currentQuestion] === index;

    radio.addEventListener("change", () => {
      answers[currentQuestion] = index;
    });

    const text = document.createTextNode(option.text);

    label.append(radio, text);
    container.appendChild(label);
  });

  $("backBtn").disabled = currentQuestion === 0;

  $("nextBtn").textContent =
    currentQuestion === questions.length - 1
      ? "Submit Assessment"
      : "Next";
}

function previousQuestion() {
  if (currentQuestion > 0) {
    currentQuestion--;
    renderQuestion();
  }
}

async function nextQuestion() {
  if (answers[currentQuestion] === null) {
    showMessage("Please select one answer before continuing.");
    return;
  }

  showMessage("");

  if (currentQuestion < questions.length - 1) {
    currentQuestion++;
    renderQuestion();
    return;
  }

  await submitAssessment();
}

async function submitAssessment() {
  $("nextBtn").disabled = true;
  showMessage("");

  try {
    const selections = questions.map((question, index) => ({
      questionId: question.id,
      optionIndex: answers[index]
    }));

    const response = await fetch("/api/assess", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: studentName,
        major: studentMajor,
        selections
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Assessment submission failed.");
    }

    displayResults(data);
  } catch (error) {
    showMessage(error.message);
  } finally {
    $("nextBtn").disabled = false;
  }
}

function displayResults(data) {
  showSection("results");

  $("studentSummary").textContent =
    `${studentName} — ${studentMajor}`;

  const container = $("careerResults");
  container.replaceChildren();

  const recommendations = data.recommendations || [];

  if (recommendations.length === 0) {
    showMessage("No career recommendations were returned.");
    return;
  }

  recommendations.forEach((result, index) => {
    const card = document.createElement("div");
    card.className = "career";

    const heading = document.createElement("h3");
    heading.textContent =
      `${index + 1}. ${(result.career || result.id || "Career")
        .replace(/_/g, " ")}`;

    const score = document.createElement("p");
    score.textContent = `Recommendation score: ${result.score ?? "N/A"}`;

    card.append(heading, score);

    if (result.explanation) {
      const explanation = document.createElement("p");
      explanation.textContent = result.explanation;
      card.appendChild(explanation);
    }

    container.appendChild(card);
  });
}

function restartAssessment() {
  questions = [];
  answers = [];
  currentQuestion = 0;
  showMessage("");
  showSection("welcome");
}

$("startBtn").addEventListener("click", startAssessment);
$("backBtn").addEventListener("click", previousQuestion);
$("nextBtn").addEventListener("click", nextQuestion);
$("restartBtn").addEventListener("click", restartAssessment);
