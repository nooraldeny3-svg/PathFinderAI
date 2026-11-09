"""Train and evaluate a demonstration career classifier.
Run: python train_model.py (from any working directory).
"""
from pathlib import Path
import json
import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

HERE = Path(__file__).resolve().parent
FEATURES = ["interest", "skill", "personality", "workstyle", "goal"]
TARGET = "career"


def main():
    df = pd.read_csv(HERE / "dataset.csv", dtype=str)
    required = FEATURES + [TARGET]
    if any(c not in df.columns for c in required):
        raise ValueError(f"Dataset must contain: {required}")
    df = df[required].dropna().copy()
    for col in required:
        df[col] = df[col].str.strip().str.lower()
    df = df[(df[required] != "").all(axis=1)]
    original_count = len(df)
    df = df.drop_duplicates().reset_index(drop=True)
    if df[TARGET].nunique() < 2 or df[TARGET].value_counts().min() < 2:
        raise ValueError("Need at least two careers and two unique rows per career.")

    X_train, X_test, y_train, y_test = train_test_split(
        df[FEATURES], df[TARGET], test_size=0.25, stratify=df[TARGET], random_state=42
    )
    pipeline = Pipeline([
        ("preprocessor", ColumnTransformer([
            ("categorical", OneHotEncoder(handle_unknown="ignore"), FEATURES)
        ])),
        ("classifier", RandomForestClassifier(n_estimators=200, random_state=42,
                                               class_weight="balanced")),
    ])
    pipeline.fit(X_train, y_train)
    predictions = pipeline.predict(X_test)
    labels = sorted(df[TARGET].unique())
    report = {
        "dataset_rows": original_count,
        "unique_rows": len(df),
        "duplicates_removed": original_count - len(df),
        "train_rows": len(X_train),
        "test_rows": len(X_test),
        "features": FEATURES,
        "career_labels": labels,
        "accuracy": float(accuracy_score(y_test, predictions)),
        "classification_report": classification_report(
            y_test, predictions, labels=labels, output_dict=True, zero_division=0
        ),
        "confusion_matrix": confusion_matrix(y_test, predictions, labels=labels).tolist(),
        "evaluation_note": (
            "Small single-split holdout on supplied dataset. Dataset provenance not verified. "
            "This does not establish accuracy for real students or graduate outcomes."
        ),
    }
    joblib.dump({"pipeline": pipeline, "features": FEATURES, "career_labels": labels},
                HERE / "career_model.pkl")
    (HERE / "model_evaluation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Model saved to {HERE / 'career_model.pkl'}")
    print(f"Evaluation saved to {HERE / 'model_evaluation.json'}")
    print(f"Unique examples: {len(df)}; holdout examples: {len(X_test)}")
    print(f"Holdout accuracy: {report['accuracy']:.3f} (not real-world validation)")


if __name__ == "__main__":
    main()
