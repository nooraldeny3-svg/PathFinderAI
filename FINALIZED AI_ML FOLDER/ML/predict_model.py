"""Predict career matches from five categorical student features.
Example: python predict_model.py --interest coding --skill python --personality analytical --workstyle independent --goal innovation
Or: echo '{"interest":"coding",...}' | python predict_model.py --json-stdin
"""
from pathlib import Path
import argparse
import json
import sys
import joblib
import pandas as pd

HERE = Path(__file__).resolve().parent
FEATURES = ["interest", "skill", "personality", "workstyle", "goal"]


def predict(profile, top_n=5):
    bundle = joblib.load(HERE / "career_model.pkl")
    missing = [key for key in FEATURES if key not in profile or not str(profile[key]).strip()]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")
    row = {key: str(profile[key]).strip().lower() for key in FEATURES}
    pipeline = bundle["pipeline"]
    probabilities = pipeline.predict_proba(pd.DataFrame([row]))[0]
    careers = pipeline.named_steps["classifier"].classes_
    ranking = sorted(
        ({"careerId": str(career), "modelScore": round(float(prob) * 100, 2)}
         for career, prob in zip(careers, probabilities)),
        key=lambda entry: entry["modelScore"], reverse=True
    )
    return {"predictedCareer": ranking[0]["careerId"],
            "topRecommendations": ranking[:top_n],
            "note": "Model scores are not validated probabilities of career success."}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-stdin", action="store_true", help="Read a JSON profile from stdin")
    for feature in FEATURES:
        parser.add_argument(f"--{feature}")
    args = parser.parse_args()
    try:
        profile = json.load(sys.stdin) if args.json_stdin else {f: getattr(args, f) for f in FEATURES}
        print(json.dumps(predict(profile), indent=2))
    except (ValueError, FileNotFoundError, KeyError) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
