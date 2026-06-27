# AEGIS-NET Network Anomaly Analytics

AEGIS-NET is a production-facing cybersecurity analytics dashboard for detecting anomalous network traffic from uploaded CSV datasets. Its frontend uses React 18, TypeScript, Axios, D3.js, Vite, CSS, browser `localStorage`, and AWS Amplify alongside a FastAPI backend and trained machine-learning models deployed through AWS.

The final system performs binary network-traffic classification:

- `normal`: traffic predicted as normal.
- `attack`: traffic predicted as malicious/anomalous.
- `review_recommended`: a UI display category derived from probability thresholds. It is not a third machine-learning class.

## 1. Project Overview

| Item | Description |
| --- | --- |
| Project name | AEGIS-NET Network Anomaly Analytics |
| Purpose | Analyse uploaded network traffic records and present AI-assisted security insights through a SOC-style dashboard. |
| Cybersecurity problem | Security teams need fast triage of large traffic datasets to identify records that look normal, suspicious enough for review, or attack-like. |
| Final primary model | XGBoost is the recommended primary model when available. |
| Supported comparison model | Random Forest is loaded and used for comparison where the artifact is available. |
| Optional legacy model path | Isolation Forest is supported by the loader if an artifact exists, but it is not the final claimed primary model. |
| Datasets | Assignment datasets based on UNSW-NB15 and NSL-KDD/KDD-style traffic, plus local demo datasets for presentation. |
| Frontend | React 18, TypeScript, Axios, D3.js, Vite, CSS, browser `localStorage`, and AWS Amplify. |
| Backend | FastAPI, Pydantic, pandas, scikit-learn-style preprocessing, XGBoost/joblib/pickle model loading. |
| Deployment | AWS Amplify for frontend and AWS App Runner for backend. |

## 2. System Architecture

```text
React 18 + TypeScript
        |
        | Axios
        v
Central API Client (Frontend/src/utils/api.ts)
        |
        v
FastAPI Backend
        |
        v
Business Logic (Backend/services/)
        |
        v
Preprocessing Pipeline
        |
        v
XGBoost / Random Forest
```

### Frontend HTTP Communication

The frontend uses one centralized Axios client located at `Frontend/src/utils/api.ts`. All React pages communicate with the FastAPI backend through this shared API layer rather than issuing HTTP requests directly.

The Axios client provides:

- Centralized `VITE_API_BASE_URL` configuration.
- Production AWS App Runner fallback URL.
- Standard 30-second request timeout.
- Extended 180-second timeout for dataset uploads.
- Automatic JSON request and response handling.
- Multipart form upload support with browser-generated boundaries.
- Consistent FastAPI and network error normalization.
- Typed `getJson<T>()`, `postJson<T>()`, and `postMultipart<T>()` helpers.

React components do not import Axios or communicate with the backend directly. Page components call domain utility functions, which use the centralized client.

Storage and runtime behavior:

- Browser `localStorage` stores only the latest processed upload result preview so Upload Logs and Dashboard can restore the latest analysis after navigation or refresh.
- Backend runtime memory stores dashboard upload counters, recent alerts, recent detections, live visitor events, and latest self-test result.
- Backend memory resets when App Runner restarts or redeploys.
- Amazon S3 is used for model/preprocessing artifacts in production.
- Uploaded files and upload history are not stored permanently by the application.
- No DynamoDB, SQL database, MongoDB, or permanent upload database is required by the final implementation.

## 3. Project Folder Structure

```text
.
├── Backend/
│   ├── main.py
│   ├── schemas.py
│   ├── requirements.txt
│   ├── feature_columns.json
│   ├── model_metrics.json
│   ├── preprocessing_pipeline.json
│   ├── preprocessing_pipeline_metadata.json
│   ├── services/
│   ├── scripts/
│   └── tests/
├── Frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── public/
│   └── src/
├── datasets/
│   ├── external_test/
│   └── processed_datasets/
├── demo_datasets/
├── models/
├── amplify.yml
└── README.md
```

### Backend/

- `main.py`: FastAPI app setup, CORS, route registration, middleware, structured error handlers.
- `schemas.py`: Pydantic request/response models used by every API endpoint.
- `services/`: ML preprocessing, prediction, upload analysis, classification thresholds, runtime visitor tracking.
- `tests/`: Backend regression tests for preprocessing, validation, and display classification behavior.
- `scripts/`: Utility script for exporting a preprocessing artifact.
- `feature_columns.json`: Final 67-feature model input order.
- `preprocessing_pipeline.json`: Exported fitted preprocessing artifact used to reproduce Assignment 2 preprocessing behavior in deployment.
- `model_metrics.json`: Historical model evaluation metadata used by Model Insights.
- `requirements.txt`: Backend Python dependencies.

### Frontend/

- `src/components/`: Pages, reusable UI panels, tables, status cards, and D3 chart components.
- `src/utils/`: API client, upload cache, dashboard mapping, live visitor mapping, model insights mapping, prediction mapping, D3 helpers.
- `src/config/`: API base URL configuration.
- `src/data/`: Shared TypeScript presentation/data types.
- `src/styles/`: Global SOC-style dashboard CSS.
- `public/`: Static frontend assets.

### datasets/

- Contains original, processed, and external test datasets used during development/testing.
- `datasets/external_test/basic_data_4.csv` is a simple KDD-style dataset supported by backend preprocessing.
- `datasets/external_test/label_category_map.csv` is intentionally rejected as a mapping/reference file.

### demo_datasets/

- Contains small presentation datasets for low, moderate, and high risk upload demonstrations.

### models/

- Contains local model artifacts such as `xgboost.pkl` and `random_forest.pkl`.
- Production deployments can instead download artifacts from S3.

## 4. Important File Reference

| File | Purpose |
| --- | --- |
| `Backend/main.py` | Main FastAPI application, CORS setup, route registration, runtime request tracking, and structured error responses. |
| `Backend/schemas.py` | Pydantic request and response schemas for prediction, upload analysis, dashboard, alerts, model metrics, and live visitors. |
| `Backend/services/preprocess.py` | Validates uploaded traffic, maps aliases into the 15 harmonized input fields, applies fitted preprocessing, and aligns output to 67 features. |
| `Backend/services/predict.py` | Resolves local/S3 model artifacts, deserializes models, selects the recommended model, and performs prediction. |
| `Backend/services/upload_analysis.py` | Processes uploaded CSV/JSON files, runs batch prediction, builds summaries, charts, alerts, per-model analysis, and capped row previews. |
| `Backend/services/classification.py` | Central probability thresholds for `normal`, `review_recommended`, and `attack` display categories. |
| `Backend/services/visitor_tracker.py` | In-memory runtime visitor/request tracker for `/live-visitors` and `/top-routes`; no database persistence. |
| `Backend/model_metrics.json` | Historical model evaluation metadata displayed by Model Insights. |
| `Backend/preprocessing_pipeline.json` | Saved preprocessing artifact exported from the Assignment 2-style preprocessing pipeline. |
| `Backend/preprocessing_pipeline_metadata.json` | Metadata describing the exported preprocessing artifact. |
| `Backend/feature_columns.json` | Final 67-feature contract expected by deployed models. |
| `Backend/scripts/export_preprocessing_pipeline.py` | Utility for reconstructing/exporting preprocessing artifacts from training data. |
| `Backend/tests/test_preprocess.py` | Regression tests for preprocessing, KDD-style fallback, label mapping rejection, and display category behavior. |
| `Frontend/src/App.tsx` | Main single-page-app router and page-view tracking trigger. |
| `Frontend/src/main.tsx` | React app entry point. |
| `Frontend/src/components/Layout.tsx` | Shared layout, collapsible sidebar, top bar, page headings, refresh and sync UI. |
| `Frontend/src/components/DashboardPage.tsx` | Dashboard summary page with backend-first data loading and local cache fallback. |
| `Frontend/src/components/UploadLogsPage.tsx` | Main dataset upload, analysis, filtering, charting, export, caching, and results-table workflow. |
| `Frontend/src/components/LiveVisitorsPage.tsx` | Runtime backend activity monitoring page using `/live-visitors` and `/top-routes`. |
| `Frontend/src/components/ModelInsightsPage.tsx` | Historical model metadata and model comparison page using `/model-metrics`. |
| `Frontend/src/components/SelfTestPage.tsx` | Manual prediction page using the 15 harmonized traffic input fields and `/predict`. |
| `Frontend/src/components/UploadBox.tsx` | Unified drag/drop and click-to-browse CSV upload component. |
| `Frontend/src/components/DataTable.tsx` | Reusable table component used for paginated/filterable result displays. |
| `Frontend/src/components/BarChart.tsx` | D3 bar chart used by dashboard, visitors, model insights, and upload model analysis. |
| `Frontend/src/components/PieChart.tsx` | D3 donut/pie chart for distribution views. |
| `Frontend/src/components/LineChart.tsx` | D3 line chart for dashboard trend views. |
| `Frontend/src/components/D3RiskTrendChart.tsx` | Upload Logs grouped anomaly-risk trend with zoom/pan and threshold lines. |
| `Frontend/src/components/D3ScatterPlot.tsx` | Upload Logs traffic feature explorer scatter plot. |
| `Frontend/src/components/D3ProtocolRiskChart.tsx` | Upload Logs protocol risk comparison chart. |
| `Frontend/src/components/D3ProbabilityHistogram.tsx` | Upload Logs attack-probability distribution chart. |
| `Frontend/src/components/D3HeatmapChart.tsx` | Confusion-matrix heatmap when labelled upload data is available. |
| `Frontend/src/utils/api.ts` | Central Axios client, typed HTTP helpers, timeout policy, multipart support, and FastAPI error normalization. |
| `Frontend/src/config/api.ts` | API base URL configuration via `VITE_API_BASE_URL`. |
| `Frontend/src/utils/uploadAnalysis.ts` | Upload response normalization, localStorage cache management, CSV/JSON export, template export, chart data mapping. |
| `Frontend/src/utils/dashboard.ts` | Dashboard backend summary mapping and local upload-cache fallback logic. |
| `Frontend/src/utils/liveVisitors.ts` | Live visitor/top route API mapping and page-view ping helper. |
| `Frontend/src/utils/modelInsights.ts` | Model metrics API mapping and formatting helpers. |
| `Frontend/src/utils/predict.ts` | Self-Test request mapping from frontend form fields to FastAPI `/predict`. |
| `Frontend/src/utils/d3ChartUtils.ts` | Shared D3 tooltip, animation, and PNG export helpers. |
| `Frontend/src/utils/sync.ts` | Shared sync interval constants and callback types. |
| `Frontend/src/styles/global.css` | Main application styling, responsive layout, sidebar, cards, tables, charts, and upload dashboard styles. |
| `Frontend/index.html` | Vite HTML shell and accessibility widget script location. |
| `amplify.yml` | AWS Amplify build configuration for the frontend. |

### Frontend API Utility Layer

These modules isolate networking and response mapping from UI components:

| File | Purpose |
| --- | --- |
| `Frontend/src/utils/api.ts` | Creates the single Axios client and provides typed JSON/multipart HTTP helpers. |
| `Frontend/src/utils/dashboard.ts` | Loads Dashboard summary, alerts, and top-route data. |
| `Frontend/src/utils/uploadAnalysis.ts` | Uploads CSV files and normalizes Upload Logs analysis responses. |
| `Frontend/src/utils/liveVisitors.ts` | Loads live visitor/top-route activity and sends privacy-limited page-view pings. |
| `Frontend/src/utils/modelInsights.ts` | Loads and normalizes model metrics. |
| `Frontend/src/utils/predict.ts` | Maps Self-Test values and submits prediction requests. |

## 5. Page Overview

### Dashboard

Purpose:

- Summarise backend upload analysis activity, alerts, visitor metrics, routes, and latest self-test result.

Features:

- Backend-first data loading from `/dashboard-summary`, `/alerts`, and `/top-routes`.
- Local upload cache fallback if backend summary is empty or unavailable.
- Summary cards, normal vs flagged distribution, recent detection trend, alert list, visitor summary, top routes, and latest self-test card.

Charts:

- D3 donut chart for normal/review/attack distribution.
- D3 line chart for recent detection history.

User interactions:

- Manual refresh button.
- Auto refresh through shared sync logic.
- Restored local cache notice when backend summary has no upload data.

### Upload Logs

Purpose:

- Upload a CSV network traffic dataset and analyse it through the deployed backend model pipeline.

Features:

- Unified drag/drop or click-to-browse upload zone.
- CSV template download.
- Backend `/upload-log` integration.
- Full-dataset summary cards and chart aggregates.
- Capped row preview for browser performance.
- Dataset model analysis section.
- Search, sort, filters, pagination, CSV export, JSON export, chart PNG export.
- Local browser cache restore and clear-result control.

Charts:

- D3 prediction distribution donut chart.
- D3 anomaly-risk trend chart with zoom/pan and threshold lines.
- D3 scatter plot feature explorer.
- D3 protocol risk comparison chart.
- D3 attack-probability histogram.
- D3 model performance bar chart when metrics are available.
- D3 confusion-matrix heatmap when ground-truth labels are available.

User interactions:

- Click chart segments/bars/buckets to filter result rows.
- Search row preview records.
- Sort table rows.
- Change rows per page.
- Reset filters.
- Export filtered rows or full normalized analysis JSON.
- Export chart cards as PNG.

#### Upload Flow

1. The user selects or drops a CSV file.
2. The React Upload Logs page calls the centralized upload utility.
3. Axios sends a multipart request to FastAPI `POST /upload-log`.
4. FastAPI validates the dataset and upload constraints.
5. Backend preprocessing maps and aligns the traffic features.
6. Available machine-learning models generate predictions and aggregate analysis.
7. FastAPI returns the structured JSON response.
8. Axios receives and normalizes the response or any FastAPI error.
9. React updates KPI cards, D3.js charts, the paginated table, and the shared `localStorage` cache.

### Live Visitors

Purpose:

- Show runtime activity reaching the FastAPI backend and page-view pings sent by the frontend.

Features:

- Uses `/live-visitors` and `/top-routes`.
- Auto-refresh every 5 seconds.
- Shows active visitors, flagged visitors, recent backend/page-view activity, route pressure, visitor identifiers, and flagged requests.

Charts:

- D3 bar chart for top routes.

User interactions:

- Manual refresh.
- Auto refresh.
- Empty/error states when no runtime activity exists.

Important wording:

- This page does not claim full network packet capture or all public internet traffic. It reports backend runtime request activity and tracked page-view pings.

### Model Insights

Purpose:

- Present historical model evaluation metadata and explain which model is recommended by backend metadata.

Features:

- Uses `/model-metrics`.
- Shows recommended model, historical accuracy, precision, recall, and F1-score.
- Comparison table for available models.

Charts:

- D3 bar charts for F1-score, accuracy, precision, and recall comparisons.

User interactions:

- Auto refresh.
- Professional empty states if model metadata is unavailable.

Important wording:

- These are historical/stored model metrics, not live accuracy from the latest upload unless the Upload Logs dataset itself contains labels and reports dataset-specific metrics.

### Self-Test

Purpose:

- Allow a presenter/tester to manually submit one harmonized traffic record to `/predict`.

Features:

- Default valid sample values are loaded on page load.
- Attack-like sample button.
- Reset sample button.
- Frontend validation for all 15 harmonized fields.
- Real backend `/predict` call.

User interactions:

- Edit fields.
- Load sample normal traffic.
- Load sample attack-like traffic.
- Run prediction.
- View binary prediction, attack probability, confidence, and timestamp.

#### Self-Test Flow

1. The user enters traffic values or loads a verified sample.
2. React calls the typed prediction utility.
3. Axios sends JSON to FastAPI `POST /predict`.
4. FastAPI validates the 15 harmonized input fields.
5. The preprocessing and prediction services execute.
6. FastAPI returns a structured JSON prediction response.
7. React displays the binary prediction, attack probability, confidence, and timestamp.

## 6. API Endpoints

| Method | Endpoint | Purpose | Used By |
| --- | --- | --- | --- |
| `GET` | `/` | Basic service message. | Browser/manual check |
| `GET` | `/health` | Health check for frontend sync and App Runner. | Layout/pages, deployment |
| `POST` | `/predict` | Predict one 15-feature harmonized traffic record. | Self-Test |
| `POST` | `/upload-log` | Analyse uploaded CSV/JSON dataset, return summaries, charts, model analysis, alerts, and capped row preview. | Upload Logs |
| `GET` | `/model-metrics` | Return historical model metrics and recommended model metadata. | Model Insights |
| `GET` | `/dashboard-summary` | Return runtime upload summary, visitor metrics, recent detections, and latest self-test. | Dashboard |
| `GET` | `/alerts` | Return recent runtime upload and visitor alerts. | Dashboard |
| `GET` | `/live-visitors` | Return recent runtime backend/page-view activity. | Live Visitors |
| `POST` | `/track-visit` | Record a privacy-limited frontend page-view ping in backend memory. | App router |
| `GET` | `/top-routes` | Return recent route request counts and suspicious counts. | Dashboard, Live Visitors |
| `GET` | `/debug-cors` | Debug CORS/environment details when enabled. Returns `404` unless `ENABLE_DEBUG_ENDPOINTS=true`. | Developer diagnostics |
| `GET` | `/debug-models` | Debug model/S3 artifact status when enabled. Returns `404` unless `ENABLE_DEBUG_ENDPOINTS=true`. | Developer diagnostics |

### Key Request Formats

`POST /predict` expects JSON using the 15 harmonized model fields:

```json
{
  "duration": 1.2,
  "src_bytes": 1200,
  "dst_bytes": 800,
  "total_bytes": 2000,
  "byte_ratio": 1.5,
  "activity_count": 2,
  "service_count": 1,
  "same_service_rate": 0.8,
  "destination_host_count": 3,
  "destination_host_service_count": 2,
  "protocol_group": "TCP",
  "service_group": "WEB",
  "connection_group": "Established",
  "service_detail": "http",
  "connection_detail": "sf"
}
```

`POST /upload-log` expects multipart form data:

```text
file=<CSV or JSON file>
```

`POST /track-visit` expects JSON:

```json
{
  "route": "/dashboard",
  "timestamp": "2026-06-27T00:00:00.000Z"
}
```

## 7. Machine Learning Pipeline

### Dataset

The project uses network intrusion/anomaly datasets based on UNSW-NB15 and NSL-KDD/KDD-style traffic. The backend accepts:

- Full harmonized datasets with the final engineered feature fields.
- Simple KDD-style datasets with columns such as `duration`, `protocol_type`, `service`, `flag`, `src_bytes`, `dst_bytes`, `count`, `srv_count`, and `label`.
- Headerless UNSW-style raw data only when it matches the supported 49-column schema.

### Feature Engineering and Preprocessing

The backend maps raw/aliased fields into 15 harmonized input fields:

- Numeric: `duration`, `src_bytes`, `dst_bytes`, `total_bytes`, `byte_ratio`, `activity_count`, `service_count`, `same_service_rate`, `destination_host_count`, `destination_host_service_count`.
- Categorical: `protocol_group`, `service_group`, `connection_group`, `service_detail`, `connection_detail`.

Simple KDD-style fallback handling:

- `destination_host_count` can be derived from `count`.
- `destination_host_service_count` can be derived from `srv_count`.
- `activity_count` maps from `count`.
- `service_count` maps from `srv_count`.
- `same_service_rate` can fall back to a safe derived/default value when absent.

The preferred path uses `Backend/preprocessing_pipeline.json`, which stores the fitted preprocessing behavior:

- numeric median imputation;
- robust scaling centers/scales;
- categorical imputation;
- one-hot category order;
- final feature output names.

The transformed dataframe is aligned to `Backend/feature_columns.json`, which defines the final 67-feature model input order. Missing model columns are filled with `0.0`, extra columns are dropped, and column order is corrected.

### Model Loading

The backend can load artifacts from:

- local `models/`;
- local backend artifact folders;
- S3 using `MODEL_S3_BUCKET`, `MODEL_S3_PREFIX`, or exact model key environment variables.

Supported serializers:

- `pickle`;
- `joblib`;
- `auto`, which attempts supported serializers in order.

Loaded models are cached in process memory after first load to avoid reloading on every request.

### Prediction

The prediction pipeline:

1. Validate request/upload input.
2. Map raw traffic fields into harmonized model inputs.
3. Apply fitted preprocessing when available.
4. Align to the 67-feature contract.
5. Run available models.
6. Select the best/recommended model from model metadata where possible.
7. Return binary result, attack probability, confidence, preprocessing status, and per-model results.

### Thresholds and Post-Processing

Threshold logic is centralized in `Backend/services/classification.py`.

- `attack` is returned when the model predicts attack or attack probability reaches the attack threshold.
- `review_recommended` is a display category when the probability is high enough for analyst review but not treated as a separate model class.
- `normal` is shown for records below the review threshold.

Dataset-specific accuracy, precision, recall, F1-score, ROC-AUC, and confusion matrix are calculated only when the uploaded dataset includes usable ground-truth labels. Accuracy is not invented for unlabelled datasets.

## 8. Storage Strategy

| Storage area | What is stored | Persistence |
| --- | --- | --- |
| Browser `localStorage` | Latest processed upload analysis preview, summary, chart data, model analysis, filename, generated time, and metadata. | Local to the user's browser; can be cleared from Upload Logs. |
| Backend runtime memory | Upload counters, recent alerts, recent detections, latest self-test result, live visitor events, route counts. | Temporary; resets on App Runner restart/redeploy. |
| Amazon S3 | Model, preprocessing, and metrics artifacts when configured. | Persistent artifact storage. |
| Database | None in final implementation. | Not applicable. |

Uploaded CSV files are not permanently stored by the frontend or backend.

## 9. Interactive Features

Completed interactions include:

- CSV drag/drop upload.
- Click upload area to browse.
- Analyze file action.
- Download CSV template.
- Upload analysis cache restore.
- Clear cached result.
- Dashboard backend-first loading with local cache fallback.
- D3 chart tooltips.
- D3 chart click-to-filter interactions.
- D3 risk trend zoom and pan.
- D3 chart PNG export.
- CSV export for filtered upload rows.
- JSON export for normalized upload analysis.
- Table search.
- Table sorting.
- Table pagination.
- Rows-per-page control.
- Protocol/category/probability/row-range filters.
- Reset filters.
- Sidebar collapse/expand with `localStorage` preference.
- Responsive layout for desktop, laptop, and tablet widths.
- Auto-refresh for backend-connected pages.
- Live Visitors 5-second polling.
- Manual refresh button.
- Self-Test sample loading and form validation.
- Professional loading, empty, and error states.

## 10. Validation and Error Handling

### Frontend Validation

- Upload file must be a CSV in the current UI.
- Empty files are rejected.
- Files above the frontend size limit are rejected before upload.
- Self-Test validates all 15 harmonized fields before calling `/predict`.
- Validation messages appear after user edits/submits invalid input, not immediately on initial load.

### Backend Validation

- Upload supports CSV and JSON service-side.
- Maximum upload size: 25 MB.
- Maximum upload rows: 250,000.
- Returned row preview cap: 1,000 records.
- Empty/invalid files are rejected.
- Required traffic feature groups are validated.
- Numeric fields must be numeric and non-negative.
- Mapping/reference files such as label/category maps are rejected with a specific message:

```text
This file is a label/category mapping file, not a network traffic dataset. Please upload a dataset containing traffic features such as duration, protocol_type, service, flag, src_bytes, dst_bytes, count, srv_count, and label.
```

### Structured Errors

FastAPI returns structured JSON errors with fields such as:

- `error`;
- `message`;
- `detail`;
- `details`;
- `stage`.

Unexpected exceptions are logged on the server. Production responses avoid exposing raw internal tracebacks unless debug endpoints are explicitly enabled.

## 11. Deployment

### Frontend: AWS Amplify

Amplify builds the `Frontend/` application using `amplify.yml`:

```yaml
version: 1
applications:
  - appRoot: Frontend
    frontend:
      phases:
        preBuild:
          commands:
            - npm install
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: dist
        files:
          - '**/*'
```

Production frontend environment:

```text
VITE_API_BASE_URL=https://guaepynme4.ap-southeast-2.awsapprunner.com
```

### Backend: AWS App Runner

App Runner runs the FastAPI backend. The expected production command is equivalent to:

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8080
```

Important backend environment variables:

| Variable | Purpose |
| --- | --- |
| `ALLOWED_ORIGINS` | Comma-separated allowed frontend origins for CORS. |
| `MODEL_S3_BUCKET` | S3 bucket containing model/preprocessing artifacts. |
| `MODEL_S3_PREFIX` | S3 prefix for artifacts. |
| `MODEL_SERIALIZER` | `auto`, `pickle`, or `joblib`. |
| `XGBOOST_MODEL_S3_KEY` | Optional exact S3 key for XGBoost. |
| `RANDOM_FOREST_MODEL_S3_KEY` | Optional exact S3 key for Random Forest. |
| `PREPROCESSING_PIPELINE_S3_KEY` | Optional exact S3 key for preprocessing artifact. |
| `MODEL_METRICS_S3_KEY` | Optional exact S3 key for model metrics. |
| `REQUIRE_FITTED_PREPROCESSOR` | If true, reject fallback preprocessing instead of allowing it with a warning. |
| `ENABLE_DEBUG_ENDPOINTS` | Enables `/debug-cors` and `/debug-models` only when set to true-like value. Keep false in production. |

Example current backend values used during production testing:

```text
MODEL_S3_BUCKET=network-anomaly-data
MODEL_S3_PREFIX=model-artifacts/2026-04-02/
MODEL_SERIALIZER=auto
ALLOWED_ORIGINS=https://main.d11hjjhgamlwj2.amplifyapp.com
```

CORS is configured in `Backend/main.py` using `ALLOWED_ORIGINS`.

The App Runner instance role must have `s3:GetObject` permission for the configured model, preprocessing, and metrics artifacts.

## 12. Demo Datasets

| Dataset | Purpose |
| --- | --- |
| `demo_datasets/demo_low_risk_network_traffic.csv` | Demonstrates a mostly normal upload with a lower number of attacks/review records. Useful for showing normal operation and clean dashboard behavior. |
| `demo_datasets/demo_moderate_risk_network_traffic.csv` | Demonstrates a mixed dataset with enough flagged records to show filtering, charts, review rows, and model-analysis behavior. |
| `demo_datasets/demo_high_risk_network_traffic.csv` | Demonstrates a higher-risk upload with stronger attack distribution for presentation impact. |
| `datasets/external_test/basic_data_4.csv` | Simple KDD-style dataset used to verify fallback mapping for columns such as `count` and `srv_count`. |
| `datasets/external_test/label_category_map.csv` | Negative test file that should be rejected because it is a mapping/reference file, not network traffic. |

Suggested presentation flow:

1. Open Dashboard.
2. Open Upload Logs.
3. Upload the low-risk demo dataset.
4. Review summary cards and charts.
5. Clear result, then upload moderate or high-risk dataset.
6. Demonstrate filters, table search, pagination, and exports.
7. Open Live Visitors to show backend/page-view runtime activity.
8. Open Self-Test and run normal/attack-like sample prediction.
9. Open Model Insights to explain historical model metadata.

## 13. Known Limitations

- Backend runtime memory resets on App Runner restart or redeploy.
- No permanent database is used for upload history, visitor history, or prediction history.
- Browser upload cache is local to the user's device/browser only.
- Upload row preview is capped at 1,000 records to protect browser performance; summaries and charts still use all analysed rows.
- No SHAP or real per-feature contribution explanation is deployed.
- Live Visitors reports FastAPI request activity and frontend page-view pings, not full packet capture or all real network traffic.
- Historical `model_metrics.json` values are stored evaluation metadata; they should not be described as live upload accuracy.
- Upload dataset-specific accuracy metrics are shown only when usable ground-truth labels are present.
- Debug endpoints are intentionally disabled unless `ENABLE_DEBUG_ENDPOINTS=true`.
- A project-owned automated frontend test suite is not included; the frontend is verified through TypeScript build and manual UI testing.

## Local Development

### Backend

Python 3.11 is recommended.

```bash
cd Backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8080
```

Verify backend:

```bash
python -c "import main"
curl http://localhost:8080/health
```

### Frontend

```bash
cd Frontend
npm ci
npm run dev
```

Create `Frontend/.env.local` for local development:

```text
VITE_API_BASE_URL=http://localhost:8080
```

## Verification Commands

### Frontend Networking Verification

The frontend uses a single centralized Axios client.

Verification completed:

- No browser Fetch API usage remains under `Frontend/src`.
- No React component imports Axios directly.
- All backend networking flows through `Frontend/src/utils/api.ts` and its domain utility modules.
- Upload Logs, Dashboard, Live Visitors, Model Insights, and Self-Test use the shared API layer.

Frontend build:

```bash
cd Frontend
npm run build
```

Backend compile/import:

```bash
cd ..
PYTHONPYCACHEPREFIX=/tmp/aegis-pycache Backend/.venv/bin/python -m compileall \
  Backend/main.py Backend/schemas.py Backend/services Backend/scripts Backend/tests

Backend/.venv/bin/python -c "import sys; sys.path.insert(0, 'Backend'); import main; print('backend import ok')"
```

Backend tests:

```bash
Backend/.venv/bin/python -m unittest discover Backend/tests
```

Whitespace check:

```bash
git diff --check
```
