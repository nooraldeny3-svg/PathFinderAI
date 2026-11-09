
from pathlib import Path
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    ConfusionMatrixDisplay
)

# ======================================
# 1. PROJECT PATHS
# ======================================

BASE_DIR = Path(__file__).resolve().parent.parent
ML_DIR = BASE_DIR / "ML"
RESULTS_DIR = BASE_DIR / "results"

RESULTS_DIR.mkdir(parents=True, exist_ok=True)

# ======================================
# 2. LOAD DATASET
# ======================================

df = pd.read_csv(ML_DIR / "dataset.csv")

features = [
    "interest",
    "skill",
    "personality",
    "workstyle",
    "goal"
]

target = "career"

required_columns = features + [target]

if not set(required_columns).issubset(df.columns):
    raise ValueError("Dataset is missing required columns.")

if df[required_columns].isnull().any().any():
    raise ValueError("Dataset contains missing values.")

X = df[features]
y = df[target]

# ======================================
# 3. TRAIN / TEST SPLIT
# ======================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

# ======================================
# 4. RANDOM FOREST MODEL
# ======================================

preprocessor = ColumnTransformer(
    transformers=[
        (
            "categorical",
            OneHotEncoder(handle_unknown="ignore"),
            features
        )
    ]
)

model = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        (
            "classifier",
            RandomForestClassifier(
                n_estimators=100,
                random_state=42
            )
        )
    ]
)

model.fit(X_train, y_train)

# ======================================
# 5. PREDICTIONS AND ACCURACY
# ======================================

y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

labels = sorted(y.unique())

# ======================================
# 6. SAVE MODEL ACCURACY
# ======================================

accuracy_text = f"""AI-POWERED CAREER GUIDANCE SYSTEM
RANDOM FOREST MODEL EVALUATION
=============================================

Total dataset records: {len(df)}
Training samples: {len(X_train)}
Testing samples: {len(X_test)}
Career categories: {y.nunique()}

Evaluation method:
Stratified 80/20 train-test split
Random state: 42
Random Forest trees: 100

Test accuracy: {accuracy:.4f}
Test accuracy percentage: {accuracy * 100:.2f}%
Correct predictions: {sum(y_test == y_pred)}
Incorrect predictions: {sum(y_test != y_pred)}

Note:
This evaluates a freshly trained model on the held-out
test split. It does not directly evaluate the saved
career_model.pkl used by the website.
"""

(RESULTS_DIR / "model_accuracy.txt").write_text(
    accuracy_text,
    encoding="utf-8"
)

# ======================================
# 7. CLASSIFICATION REPORT
# ======================================

report = classification_report(
    y_test,
    y_pred,
    labels=labels,
    zero_division=0
)

(RESULTS_DIR / "classification_report.txt").write_text(
    "RANDOM FOREST CLASSIFICATION REPORT\n"
    "==================================\n\n"
    + report,
    encoding="utf-8"
)

# ======================================
# 8. CONFUSION MATRIX CSV
# ======================================

cm = confusion_matrix(
    y_test,
    y_pred,
    labels=labels
)

cm_df = pd.DataFrame(
    cm,
    index=labels,
    columns=labels
)

cm_df.index.name = "Actual / Predicted"

cm_df.to_csv(
    RESULTS_DIR / "confusion_matrix.csv"
)

# ======================================
# 9. CONFUSION MATRIX IMAGE
# ======================================

fig, ax = plt.subplots(figsize=(13, 11))

display = ConfusionMatrixDisplay(
    confusion_matrix=cm,
    display_labels=labels
)

display.plot(
    ax=ax,
    cmap="Blues",
    xticks_rotation=65,
    colorbar=False,
    values_format="d"
)

ax.set_title(
    "Random Forest Career Classification - Confusion Matrix",
    fontsize=14
)

fig.tight_layout()

fig.savefig(
    RESULTS_DIR / "confusion_matrix.png",
    dpi=200,
    bbox_inches="tight"
)

plt.close(fig)

# ======================================
# 10. SAMPLE PREDICTIONS
# ======================================

predictions = X_test.copy()

predictions["actual_career"] = y_test.values
predictions["predicted_career"] = y_pred
predictions["correct_prediction"] = (
    predictions["actual_career"]
    == predictions["predicted_career"]
)

predictions.to_csv(
    RESULTS_DIR / "sample_predictions.csv",
    index=False
)

# ======================================
# 11. EVALUATION SUMMARY
# ======================================

summary = f"""# Random Forest Model Evaluation

## Project
AI-Powered Career Guidance and Recommendation System

## Dataset
- Total records: {len(df)}
- Career categories: {y.nunique()}
- Training samples: {len(X_train)}
- Testing samples: {len(X_test)}

## Algorithm
Random Forest Classifier

## Input Features
1. Interest
2. Skill
3. Personality
4. Workstyle
5. Career Goal

## Evaluation Method
- Stratified train-test split
- Training data: 80%
- Testing data: 20%
- Random state: 42
- Number of decision trees: 100

## Evaluation Results
- Test accuracy: {accuracy * 100:.2f}%
- Correct predictions: {sum(y_test == y_pred)}
- Incorrect predictions: {sum(y_test != y_pred)}

## Generated Files
- model_accuracy.txt
- classification_report.txt
- confusion_matrix.csv
- confusion_matrix.png
- sample_predictions.csv
- evaluation_summary.md

## Limitations
The dataset contains only {len(df)} examples.
The test set contains {len(X_test)} examples.
Results may vary with a different data split or dataset.

This evaluation trains a fresh Random Forest model.
It does not directly measure the performance of the
saved career_model.pkl used by the website.

The system's questionnaire-to-ML mapping is heuristic.
Career recommendations have not been validated
against real-world graduate career outcomes.
"""

(RESULTS_DIR / "evaluation_summary.md").write_text(
    summary,
    encoding="utf-8"
)

# ======================================
# 12. FINAL OUTPUT
# ======================================

print("=" * 50)
print("MODEL EVALUATION COMPLETED")
print("=" * 50)

print(f"Dataset records: {len(df)}")
print(f"Training samples: {len(X_train)}")
print(f"Testing samples: {len(X_test)}")
print(f"Accuracy: {accuracy * 100:.2f}%")

print("\nGenerated files:")

for file in sorted(RESULTS_DIR.iterdir()):
    print(f" - {file.name}")

print("\nResults folder:")
print(RESULTS_DIR)
from sklearn.metrics import classification_report, confusion_matrix, ConfusionMatrixDisplay
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# Classification report
report = classification_report(y_test, y_pred, zero_division=0)

(RESULTS_DIR / "classification_report.txt").write_text(
    report, encoding="utf-8"
)

# Confusion matrix
labels = sorted(y.unique())
cm = confusion_matrix(y_test, y_pred, labels=labels)

pd.DataFrame(
    cm, index=labels, columns=labels
).to_csv(RESULTS_DIR / "confusion_matrix.csv")

fig, ax = plt.subplots(figsize=(13, 11))
ConfusionMatrixDisplay(
    confusion_matrix=cm,
    display_labels=labels
).plot(ax=ax, cmap="Blues", xticks_rotation=65)

fig.tight_layout()
fig.savefig(
    RESULTS_DIR / "confusion_matrix.png",
    dpi=200,
    bbox_inches="tight"
)
plt.close(fig)

# Sample predictions
predictions = X_test.copy()
predictions["actual_career"] = y_test.values
predictions["predicted_career"] = y_pred
predictions["correct_prediction"] = y_test.values == y_pred

predictions.to_csv(
    RESULTS_DIR / "sample_predictions.csv",
    index=False
)

# Evaluation summary
summary = f"""# Random Forest Model Evaluation

Project: AI-Powered Career Guidance and Recommendation System

Dataset records: {len(df)}
Training samples: {len(X_train)}
Testing samples: {len(X_test)}
Career categories: {y.nunique()}

Algorithm: Random Forest Classifier
Evaluation: Stratified 80/20 train-test split
Random state: 42
Decision trees: 100

Test accuracy: {accuracy * 100:.2f}%

Limitations:
- The test set is small.
- The evaluation trains a fresh model.
- It does not directly evaluate the saved career_model.pkl.
"""

(RESULTS_DIR / "evaluation_summary.md").write_text(
    summary, encoding="utf-8"
)

print("\nALL SIX EVALUATION FILES GENERATED SUCCESSFULLY")

