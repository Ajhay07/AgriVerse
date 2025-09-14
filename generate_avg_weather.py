from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
SOURCE_PATH = BASE_DIR / r"C:\Users\Ajhay\Downloads\India_Crop_Plantation_2020-2025_syn.xlsx"  # place Excel here
OUT_PATH = BASE_DIR / "avg_weather.csv"

if not SOURCE_PATH.exists():
    raise FileNotFoundError(f"Source Excel not found at: {SOURCE_PATH}")  # explicit guidance [2]

df = pd.read_excel(SOURCE_PATH)  # load the training source [6]
df = df.rename(columns={'Productivity (Kg/Ha)': 'Yield (Kg/Ha)'})  # align with training rename [6]

required = ['State','Season','Crop','Year','Avg_Temp_C','Rainfall_mm','Humidity_%','Yield (Kg/Ha)']
missing = [c for c in required if c not in df.columns]
if missing:
    raise ValueError(f"Missing columns in source: {missing}")  # ensure schema matches [7]

df_clean = df[required].dropna()  # drop incomplete rows [7]

avg = (
    df_clean
    .groupby(['State','Season'])[['Year','Avg_Temp_C','Rainfall_mm','Humidity_%']]
    .mean()
    .reset_index()
)  # compute seasonally averaged weather per State [6]

avg['Year'] = pd.to_numeric(avg['Year'], errors='coerce').fillna(2025).round().astype(int)  # ensure integer year [7]

avg.to_csv(OUT_PATH, index=False)  # write beside api.py [1]
print("Wrote", OUT_PATH, "rows:", len(avg))  # confirmation for ops [6]
