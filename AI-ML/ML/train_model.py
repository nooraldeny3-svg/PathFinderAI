import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import joblib

# Load dataset
data = pd.read_csv("dataset.csv")

# Create encoders
interest_encoder = LabelEncoder()
skill_encoder = LabelEncoder()
personality_encoder = LabelEncoder()
workstyle_encoder = LabelEncoder()
goal_encoder = LabelEncoder()
career_encoder = LabelEncoder()

# Convert text to numbers
data["interest"] = interest_encoder.fit_transform(data["interest"])
data["skill"] = skill_encoder.fit_transform(data["skill"])
data["personality"] = personality_encoder.fit_transform(data["personality"])
data["workstyle"] = workstyle_encoder.fit_transform(data["workstyle"])
data["goal"] = goal_encoder.fit_transform(data["goal"])

X = data[["interest", "skill", "personality", "workstyle", "goal"]]
y = career_encoder.fit_transform(data["career"])

# Train model
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X, y)

# Save model
joblib.dump(model, "career_model.pkl")

print("Model trained successfully!")