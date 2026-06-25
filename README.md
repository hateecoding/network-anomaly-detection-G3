# AEGIS-NET Network Anomaly Analytics

AEGIS-NET is a React, TypeScript, D3, FastAPI, and machine-learning application for analysing uploaded network-traffic datasets. The deployed classifiers perform binary classification only:

- `0`: Normal
- `1`: Attack

`Review recommended` is a presentation category derived from attack probability. It is not a third model class and it does not identify an attack family.

## Repository

```text
Backend/
  main.py
  schemas.py
  feature_columns.json
  model_metrics.json
  services/
    classification.py
    predict.py
    preprocess.py
    upload_analysis.py
    visitor_tracker.py
Frontend/
  src/
    components/
    config/
    utils/
models/
  xgboost.pkl
  random_forest.pkl
datasets/
```

## Important Model Limitation

The repository currently contains standalone `XGBClassifier` and `RandomForestClassifier` artifacts. It does **not** contain the fitted Assignment 2 `SimpleImputer`, `RobustScaler`, or `OneHotEncoder` objects, and the classifiers are not saved inside a scikit-learn `Pipeline`.

The backend currently:

1. maps raw aliases to 15 harmonized features;
2. engineers totals and ratios where required;
3. manually one-hot encodes categorical fields;
4. aligns the result to `Backend/feature_columns.json`;
5. sends the aligned 67-column matrix to each classifier.

This preserves column order but does not reproduce the original fitted scaling pipeline. Therefore, the metrics in `Backend/model_metrics.json` describe the original training evaluation and must not be presented as verified production inference accuracy. The correct production fix is to export the original fitted preprocessing pipeline from the training environment and deploy it without refitting.

## Backend Setup

Python 3.11 is recommended.

```bash
cd Backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8080
```

Verify:

```bash
python -c "import main"
curl http://localhost:8080/health
```

### Backend Environment

Copy `Backend/.env.example` into your deployment configuration. App Runner reads environment variables from the service configuration rather than automatically loading the file.

| Variable | Purpose |
| --- | --- |
| `ALLOWED_ORIGINS` | Comma-separated Amplify/local frontend origins |
| `MODEL_S3_BUCKET` | S3 bucket containing model artifacts |
| `MODEL_S3_PREFIX` | S3 object prefix |
| `MODEL_SERIALIZER` | `auto`, `pickle`, or `joblib` |
| `XGBOOST_MODEL_S3_KEY` | Optional exact XGBoost object key |
| `RANDOM_FOREST_MODEL_S3_KEY` | Optional exact Random Forest object key |
| `MODEL_METRICS_S3_KEY` | Optional exact metrics object key |
| `ENABLE_DEBUG_ENDPOINTS` | Keep `false` in production |

The App Runner instance role needs `s3:GetObject` for the configured artifacts.

## Frontend Setup

```bash
cd Frontend
npm ci
npm run dev
```

Create `Frontend/.env.local`:

```text
VITE_API_BASE_URL=http://localhost:8080
```

Production Amplify builds should define `VITE_API_BASE_URL` as the deployed App Runner origin.

## Main Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health |
| `POST` | `/predict` | One validated 15-feature prediction |
| `POST` | `/upload-log` | Dataset analysis with a capped row preview |
| `GET` | `/dashboard-summary` | In-memory backend activity summary |
| `GET` | `/alerts` | Recent in-memory alerts |
| `GET` | `/model-metrics` | Stored model metadata |
| `GET` | `/live-visitors` | FastAPI activity and tracked page-view pings |
| `GET` | `/top-routes` | Recent backend route activity |
| `POST` | `/track-visit` | Privacy-limited frontend page-view ping |

`/live-visitors` does not capture network packets. It reports requests reaching FastAPI and anonymous page-view events.

`/debug-cors` and `/debug-models` return `404` unless `ENABLE_DEBUG_ENDPOINTS=true`.

## Upload Behaviour

- CSV and JSON are accepted by the backend; the frontend uploader currently accepts CSV.
- Maximum request size: 25 MB.
- Maximum rows: 250,000.
- Summaries and chart aggregates use all analysed rows.
- The response returns at most 1,000 row-level preview records.
- Uploaded files are not persisted by the frontend.
- The normalized preview can be cached in browser local storage and cleared from the Upload Logs page.

The downloadable CSV template contains supported aliases for the required harmonized inputs.

## Validation and Errors

The backend validates required feature groups, numeric values, non-negative values, file size, row count, file type, and empty/invalid files. `/predict` rejects unknown fields and requires the actual 15 harmonized model inputs.

Unexpected exception details are logged on the server and hidden from production clients. Debug details are only exposed when debug endpoints are explicitly enabled.

## Verification

```bash
cd Frontend
npm run build

cd ..
PYTHONPYCACHEPREFIX=/tmp/aegis-pycache Backend/.venv/bin/python -m py_compile \
  Backend/main.py Backend/schemas.py Backend/services/*.py

git diff --check
```

Backend preprocessing and display-classification regression tests are included under `Backend/tests`. A project-owned frontend test suite is not yet included.
