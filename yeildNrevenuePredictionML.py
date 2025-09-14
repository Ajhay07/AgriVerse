import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, r2_score
import joblib

print("--- Crop Yield & Revenue Prediction Model ---")

# --- 1. Data Loading ---
print("Loading dataset...")

# Change this path to where your file is located
file_name = r"C:\Users\Ajhay\Downloads\India_Crop_Plantation_2020-2025_syn.xlsx"

try:
    df = pd.read_excel(file_name)
    print(f"Dataset '{file_name}' loaded successfully.")
    print("Original dataset shape:", df.shape)

except Exception as e:
    print(f"\nERROR: An error occurred while reading the file: {e}")
    exit()

# --- 2. Data Cleaning & Preparation ---
df.rename(columns={
    'Productivity (Kg/Ha)': 'Yield (Kg/Ha)',
    'Pricing (Min - Max Rs/Qtl)': 'Price_Range (Rs/Qtl)'
}, inplace=True)

# Drop rows with missing values in key columns
key_cols = ['State', 'Season', 'Crop', 'Yield (Kg/Ha)', 'Price_Range (Rs/Qtl)']
df.dropna(subset=key_cols, inplace=True)
print("Dropped rows with missing values in key columns. New shape:", df.shape)

# --- 3. Feature Engineering ---
def get_average_price(price_range):
    try:
        parts = str(price_range).replace(',', '').strip().split('-')
        min_price = float(parts[0])
        max_price = float(parts[1])
        return (min_price + max_price) / 2
    except (ValueError, IndexError):
        return np.nan

df['Average_Price (Rs/Qtl)'] = df['Price_Range (Rs/Qtl)'].apply(get_average_price)

# Revenue = (Yield in Quintals) * Avg Price
df['Estimated_Revenue (Rs/Ha)'] = (df['Yield (Kg/Ha)'] / 100) * df['Average_Price (Rs/Qtl)']

# Drop rows where revenue could not be calculated
df.dropna(subset=['Estimated_Revenue (Rs/Ha)'], inplace=True)
print("Feature engineering complete. Cleaned dataset shape:", df.shape)

# --- 4. Model Building ---
print("\n--- Starting Model Training ---")

# Features & Targets
features = ['State', 'Season', 'Crop']
target_yield = 'Yield (Kg/Ha)'
target_revenue = 'Estimated_Revenue (Rs/Ha)'

X = df[features]
y_yield = df[target_yield]
y_revenue = df[target_revenue]

# Train-Test Split
X_train, X_test, y_yield_train, y_yield_test, y_revenue_train, y_revenue_test = train_test_split(
    X, y_yield, y_revenue, test_size=0.2, random_state=42
)

# Preprocessing for categorical features
categorical_transformer = Pipeline(steps=[
    ('onehot', OneHotEncoder(handle_unknown='ignore'))
])

# Yield Model
yield_model_pipeline = Pipeline(steps=[
    ('preprocessor', ColumnTransformer(
        transformers=[('cat', categorical_transformer, features)]
    )),
    ('regressor', RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1))
])

# Revenue Model
revenue_model_pipeline = Pipeline(steps=[
    ('preprocessor', ColumnTransformer(
        transformers=[('cat', categorical_transformer, features)]
    )),
    ('regressor', RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1))
])

# Train Models
print("Training the Yield Prediction Model...")
yield_model_pipeline.fit(X_train, y_yield_train)
print("Yield Model trained.")

print("Training the Revenue Prediction Model...")
revenue_model_pipeline.fit(X_train, y_revenue_train)
print("Revenue Model trained.")

# --- 5. Evaluation ---
print("\n--- Evaluating Models on Test Data ---")

# Yield Evaluation
yield_predictions = yield_model_pipeline.predict(X_test)
yield_mae = mean_absolute_error(y_yield_test, yield_predictions)
yield_r2 = r2_score(y_yield_test, yield_predictions)

print("\nYield Prediction Model:")
print(f"  Mean Absolute Error (MAE): {yield_mae:.2f} Kg/Ha")
print(f"  R-squared (R²) Score: {yield_r2:.2f}")

# Revenue Evaluation
revenue_predictions = revenue_model_pipeline.predict(X_test)
revenue_mae = mean_absolute_error(y_revenue_test, revenue_predictions)
revenue_r2 = r2_score(y_revenue_test, revenue_predictions)

print("\nRevenue Prediction Model:")
print(f"  Mean Absolute Error (MAE): Rs. {revenue_mae:.2f} per Hectare")
print(f"  R-squared (R²) Score: {revenue_r2:.2f}")

# --- 6. Prediction Function ---
print("\n--- Prediction Function Ready ---")

def predict_crop_outcome(state, season, crop):
    """Predicts yield and revenue for a given state, season, and crop."""
    input_data = pd.DataFrame([[state, season, crop]], columns=features)

    predicted_yield = yield_model_pipeline.predict(input_data)[0]
    predicted_revenue = revenue_model_pipeline.predict(input_data)[0]

    print("\n-----------------------------------------")
    print(f"Prediction for '{crop}' in '{state}' during '{season}' season:")
    print(f"  -> Predicted Yield: {predicted_yield:.2f} Kg per Hectare")
    print(f"  -> Predicted Estimated Revenue: Rs. {predicted_revenue:,.2f} per Hectare")
    print("-----------------------------------------")

    return predicted_yield, predicted_revenue

# Example Predictions
predict_crop_outcome(state='Punjab', season='Kharif', crop='Rice')
predict_crop_outcome(state='Uttar Pradesh', season='Rabi', crop='Wheat')
predict_crop_outcome(state='Maharashtra', season='Kharif', crop='Cotton')

# Save trained pipelines
joblib.dump(yield_model_pipeline, "yield_model.pkl")
joblib.dump(revenue_model_pipeline, "revenue_model.pkl")

print("\nModels saved as 'yield_model.pkl' and 'revenue_model.pkl'")
