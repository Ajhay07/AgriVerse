from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path
import joblib
import pandas as pd
import os

app = Flask(__name__)
CORS(app)  # enable CORS in dev [5][6]

# ---------- Absolute paths based on this file ----------
BASE_DIR = Path(__file__).resolve().parent  # robust working-dir handling [1][3]
MODEL_YIELD_PATH = BASE_DIR / "yield_model.pkl"
MODEL_REV_PATH = BASE_DIR / "revenue_model.pkl"  # optional
AVG_WEATHER_PATH = BASE_DIR / "avg_weather.csv"

# ---------- Load models ----------
yield_model = joblib.load(MODEL_YIELD_PATH)  # must exist beside api.py [7]
revenue_model = None
if MODEL_REV_PATH.exists():
    try:
        revenue_model = joblib.load(MODEL_REV_PATH)
    except Exception:
        revenue_model = None  # tolerate missing revenue model in dev [7]

# ---------- Helpers ----------
def norm(s): return str(s).strip().lower()  # normalized keys for robust matching [4]

def load_avg_weather(path: Path):
    if not path.exists():
        print(f"avg_weather.csv not found at: {path}")
        return None  # clearly indicate missing file [2]
    try:
        df = pd.read_csv(path)
        # Validate schema
        req = ["State","Season","Avg_Temp_C","Rainfall_mm","Humidity_%"]
        for col in req:
            if col not in df.columns:
                raise ValueError(f"Column {col} missing in avg_weather.csv")
        # Coerce numerics
        for c in ["Year","Avg_Temp_C","Rainfall_mm","Humidity_%"]:
            if c in df.columns:
                df[c] = pd.to_numeric(df[c], errors="coerce")
        df["Year"] = df.get("Year", pd.Series([], dtype="float64")).fillna(2025).round().astype(int)
        # Normalized columns for lookups
        df["_state_n"] = df["State"].astype(str).str.strip().str.lower()
        df["_season_n"] = df["Season"].astype(str).str.strip().str.lower()
        return df
    except Exception as e:
        print("Failed to load avg_weather.csv:", e)
        return None  # keep API alive, signal via /health [8]

avg_weather_df = load_avg_weather(AVG_WEATHER_PATH)  # absolute path avoids CWD pitfalls [1][3]

SEASON_MAP = {
    "Kharif": "Rabi",
    "Rabi": "Zaid",
    "Zaid": "Kharif",
    "Summer": "Kharif",
    "Autumn": "Rabi",
    "Winter": "Zaid",
    "Whole Year": "Kharif"
}  # next-season heuristic [4]

# ---------- Routes ----------
@app.get("/")
def root():
    return "AgriVerse ML API is running."  # readiness string [7]

@app.get("/health")
def health():
    return jsonify(
        status="ok",
        avg_weather_loaded=bool(avg_weather_df is not None),
        avg_weather_path=str(AVG_WEATHER_PATH)
    )  # verify CSV presence and path quickly [7]

@app.post("/predict")
def predict():
    data = request.get_json(force=True)  # parse JSON body [9]
    X = pd.DataFrame([[data["state"], data["season"], data["crop"]]],
                     columns=["State","Season","Crop"])
    y = float(yield_model.predict(X))
    r = 0.0
    if revenue_model is not None:
        try:
            r = float(revenue_model.predict(X))
        except Exception:
            r = 0.0  # non-fatal in dev [7]
    return jsonify(
        predicted_yield_kg_per_ha=round(y, 2),
        predicted_revenue_rs_per_ha=round(r, 2)
    )  # keys match frontend expectations [7]

@app.post("/recommend")
def recommend():
    try:
        data = request.get_json(force=True)  # reliable JSON parse [9]
        state = data["state"]
        current_season = data["current_season"]
        current_crop = data["current_crop"]

        next_season = SEASON_MAP.get(current_season)
        if not next_season:
            return jsonify(error=f"Unknown season '{current_season}'"), 400  # input guard [8]

        if avg_weather_df is None:
            return jsonify(error="Average weather data not available"), 500  # CSV missing/unloaded [8]

        # Robust lookup
        mask = (avg_weather_df["_state_n"] == norm(state)) & (avg_weather_df["_season_n"] == norm(next_season))
        aw_df = avg_weather_df.loc[mask]
        if aw_df.empty:
            return jsonify(error=f"No weather averages for {state} in {next_season}"), 404  # coverage gap [8]

        # Safe single-row extraction without non-integer .iloc
        aw = aw_df.head(1).squeeze()  # Series of first row [4]

        # Extract numeric scalars safely
        year_val = int(pd.to_numeric(aw.get("Year", 2025), errors="coerce") or 2025)
        avg_temp = float(pd.to_numeric(aw.get("Avg_Temp_C"), errors="coerce"))
        rainfall = float(pd.to_numeric(aw.get("Rainfall_mm"), errors="coerce"))
        humidity = float(pd.to_numeric(aw.get("Humidity_%"), errors="coerce"))

        # Phase 1: if no candidates, return next season + averages so UI can pick crops
        candidates = data.get("candidates", [])
        if not candidates:
            return jsonify(
                next_season=next_season,
                weather={
                    "Year": year_val,
                    "Avg_Temp_C": avg_temp,
                    "Rainfall_mm": rainfall,
                    "Humidity_%": humidity
                }
            )  # interactive flow step 1 [7]

        # Phase 2: score candidates with yield model
        best = None
        for crop in candidates:
            X = pd.DataFrame([{
                "Year": year_val,
                "Avg_Temp_C": avg_temp,
                "Rainfall_mm": rainfall,
                "Humidity_%": humidity,
                "State": state,
                "Season": next_season,
                "Crop": crop
            }])
            try:
                pred = float(yield_model.predict(X))
            except Exception:
                continue  # skip any that fail encoding; OneHot(handle_unknown='ignore') helps [7]
            if (best is None) or (pred > best["predicted_yield"]):
                best = {"crop": crop, "predicted_yield": pred}

        if best is None:
            return jsonify(error="No predictions could be made for candidates"), 422  # nothing scored [8]

        return jsonify(
            next_season=next_season,
            recommended_crop=best["crop"],
            predicted_yield_kg_per_ha=round(best["predicted_yield"], 2)
        )  # final recommendation [7]
    except KeyError as e:
        return jsonify(error=f"Missing field: {e}"), 400  # clear client error [8]
    except Exception as e:
        return jsonify(error=str(e)), 500  # generic server error [8]

if __name__ == "__main__":
    print("BASE_DIR:", BASE_DIR)
    print("AVG_WEATHER_PATH:", AVG_WEATHER_PATH, "exists=", AVG_WEATHER_PATH.exists())
    app.run(host="127.0.0.1", port=8000, debug=True)  # dev server [7]
