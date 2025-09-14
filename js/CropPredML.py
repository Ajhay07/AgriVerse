import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
import warnings

warnings.filterwarnings('ignore')
# --- 2. Data Loading and Preprocessing ---
# Ensure the file is uploaded to your Colab session.
# You can upload files by clicking on the folder icon on the left sidebar, then the upload icon.
# After uploading, right-click on the file name and select 'Copy path'.
try:
    file_path = r'C:\Users\Ajhay\Downloads\India_Crop_Plantation_2020-2025_syn.xlsx' # Update this path after uploading the file
    df = pd.read_excel(file_path) # Assuming it's an Excel file based on the extension
    print("Dataset loaded successfully.")
except FileNotFoundError:
    print(f"\nERROR: Make sure the file '{file_path}' is uploaded to your Colab session.")
    exit()

# Rename columns for easier access and consistency
df.rename(columns={'Productivity (Kg/Ha)': 'Yield (Kg/Ha)'}, inplace=True)

# Select and clean the necessary columns, dropping rows with missing essential data
required_cols = ['State', 'Season', 'Crop', 'Year', 'Avg_Temp_C', 'Rainfall_mm', 'Humidity_%', 'Yield (Kg/Ha)']
df_clean = df[required_cols].dropna()
print(f"Dataset cleaned. Using {df_clean.shape[0]} valid records for training.")
# --- 3. Yield Prediction Model Training ---
print("\n--- Training the Yield Prediction Model ---")

# Define the features (X) and the target (y)
numeric_features = ['Year', 'Avg_Temp_C', 'Rainfall_mm', 'Humidity_%']
categorical_features = ['State', 'Season', 'Crop']
X = df_clean[numeric_features + categorical_features]
y = df_clean['Yield (Kg/Ha)']

# Create a preprocessor to handle numeric and categorical data differently
preprocessor = ColumnTransformer(
    transformers=[
        ('num', StandardScaler(), numeric_features),
        ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features)
    ])

# Create the full machine learning pipeline
yield_model_pipeline = Pipeline(steps=[
    ('preprocessor', preprocessor),
    ('regressor', RandomForestRegressor(n_estimators=150, random_state=42, n_jobs=-1))
])

# Train the model on the entire dataset
yield_model_pipeline.fit(X, y)
print("Yield Prediction Model training complete.")

# --- 4. Recommendation Logic and Function ---
print("\n--- Building the Recommendation Engine ---")

# Define the logical sequence of seasons
season_map = {
    'Kharif': 'Rabi',
    'Rabi': 'Zaid',
    'Zaid': 'Kharif',
    'Summer': 'Kharif', # Assuming Summer is similar to Zaid
    'Autumn': 'Rabi', # Assuming Autumn precedes Rabi
    'Winter': 'Zaid', # Assuming Winter precedes Zaid/Summer
    'Whole Year': 'Kharif' # Defaulting to Kharif after a whole-year crop
}

# Pre-calculate average weather conditions for prediction
# This avoids re-calculating the same values for every recommendation
avg_weather_cache = df_clean.groupby(['State', 'Season'])[numeric_features].mean().reset_index()

def recommend_next_crop(state, current_season, current_crop):
    """
    Recommends the next best crop to plant based on predicted yield.
    """
    print("\n----------------------------------------------------")
    print(f"🔄 Generating recommendation for a farmer in '{state}'...")
    print(f"   Current Crop: '{current_crop}' (Harvested in {current_season} season)")

    # STAGE 1: RULE-BASED FILTERING
    next_season = season_map.get(current_season)
    if not next_season:
        print(f"   ❌ Error: Could not determine the next season for '{current_season}'.")
        return

    print(f"   ✅ Next logical season identified: '{next_season}'")

    # Find all unique crops grown in that state during the next season
    candidate_crops = df_clean[(df_clean['State'] == state) & (df_clean['Season'] == next_season)]['Crop'].unique()

    if len(candidate_crops) == 0:
        print(f"   ❌ No suitable crops found for the '{next_season}' season in '{state}' in the dataset.")
        return

    print(f"    Found {len(candidate_crops)} potential crops for the '{next_season}' season.")

    # STAGE 2: PREDICTIVE YIELD MODELING
    # Get the average weather for the upcoming season in that state
    avg_weather = avg_weather_cache[
        (avg_weather_cache['State'] == state) & (avg_weather_cache['Season'] == next_season)
    ]

    if avg_weather.empty:
        print(f"   ❌ Cannot find average weather data for '{state}' in '{next_season}' season.")
        return

    # Use the first row of the weather data
    weather_inputs = avg_weather.iloc[0]

    predictions = []
    print("    Predicting yield for each candidate crop...")
    for crop in candidate_crops:
        # Create a dataframe for prediction
        input_data = pd.DataFrame({
            'Year': [2025], # Assuming prediction for the near future
            'Avg_Temp_C': [weather_inputs['Avg_Temp_C']],
            'Rainfall_mm': [weather_inputs['Rainfall_mm']],
            'Humidity_%': [weather_inputs['Humidity_%']],
            'State': [state],
            'Season': [next_season],
            'Crop': [crop]
        })

        # Predict the yield
        predicted_yield = yield_model_pipeline.predict(input_data)[0]
        predictions.append({'crop': crop, 'predicted_yield': predicted_yield})

    # STAGE 3: RANKING AND RECOMMENDATION
    if not predictions:
        print("   ❌ Could not generate any predictions.")
        return

    # Sort the results by predicted yield
    top_recommendation = sorted(predictions, key=lambda x: x['predicted_yield'], reverse=True)[0]

    print("\n   ✨ --- RECOMMENDATION --- ✨")
    print(f"   For the upcoming '{next_season}' season, you should plant:")
    print(f"   ->  CROP: {top_recommendation['crop']}")
    print(f"   ->  PREDICTED YIELD: {top_recommendation['predicted_yield']:.2f} Kg/Ha")
    print("----------------------------------------------------")


recommend_next_crop(state='Punjab', current_season='Kharif', current_crop='Rice')
recommend_next_crop(state='Punjab', current_season='Kharif', current_crop='Rice')
recommend_next_crop(state='Maharashtra', current_season='Zaid', current_crop='Cotton')