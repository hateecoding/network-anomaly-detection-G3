# AEGIS-NET Project Structure and Cleanup Audit

## 1. Current Website Pages

| Page | Purpose | Current status |
| --- | --- | --- |
| Dashboard | Shows latest upload-analysis totals, detection trend, alerts, top routes, and self-test status. Uses backend summary first, then latest cached Upload Logs analysis when backend upload totals are empty. | Implemented |
| Upload Logs | Uploads CSV files to `POST /upload-log`, displays validation status, KPI cards, D3 charts, filtered/paginated preview rows, top risky records, model comparison, export actions, and collapsible prediction context. | Implemented |
| Live Visitors | Shows recent FastAPI request/page-view activity from the current backend runtime using `/live-visitors` and `/top-routes`. | Implemented, runtime-memory only |
| Model Insights | Shows model metadata from `GET /model-metrics`; metrics are labelled as historical model metadata, not live upload accuracy. | Implemented |
| Self-Test | Provides a 15-field manual prediction form for `POST /predict`, with valid sample defaults and reset/sample buttons. | Implemented |

## 2. Current Frontend Folder Structure

```text
Frontend/
  index.html
  package.json
  src/
    App.tsx
    main.tsx
    components/
      DashboardPage.tsx
      UploadLogsPage.tsx
      LiveVisitorsPage.tsx
      ModelInsightsPage.tsx
      SelfTestPage.tsx
      D3*.tsx chart components
      shared layout/table/status components
    config/
      api.ts
    data/
      presentationData.ts
    styles/
      global.css
    utils/
      api.ts
      dashboard.ts
      liveVisitors.ts
      modelInsights.ts
      predict.ts
      sync.ts
      uploadAnalysis.ts
```

## 3. Current Backend Folder Structure

```text
Backend/
  main.py
  schemas.py
  feature_columns.json
  model_metrics.json
  preprocessing_pipeline.json
  preprocessing_pipeline_metadata.json
  requirements.txt
  scripts/
    export_preprocessing_pipeline.py
  services/
    classification.py
    predict.py
    preprocess.py
    upload_analysis.py
    visitor_tracker.py
  tests/
    test_preprocess.py
```

## 4. Real API Endpoints Used

| Method | Endpoint | Used by | Status |
| --- | --- | --- | --- |
| `GET` | `/` | Health/manual checks | Real |
| `GET` | `/health` | Frontend sync/health checks | Real |
| `POST` | `/predict` | Self-Test | Real |
| `POST` | `/upload-log` | Upload Logs | Real |
| `GET` | `/dashboard-summary` | Dashboard | Real |
| `GET` | `/model-metrics` | Model Insights | Real |
| `GET` | `/alerts` | Dashboard | Real |
| `GET` | `/live-visitors` | Live Visitors | Real |
| `POST` | `/track-visit` | App route-change/page-view ping | Real |
| `GET` | `/top-routes` | Dashboard and Live Visitors | Real |
| `GET` | `/debug-cors` | Manual backend debug only | Disabled unless `ENABLE_DEBUG_ENDPOINTS=true` |
| `GET` | `/debug-models` | Manual backend debug only | Disabled unless `ENABLE_DEBUG_ENDPOINTS=true` |

No current frontend usage was found for `/batch_predict`, `/statistics`, `/history`, or `DELETE /history`.

## 5. Storage Strategy

| Area | Storage strategy |
| --- | --- |
| Upload Logs | Latest normalized upload-analysis response is cached in browser `localStorage` under one key: `aegis-net.latest-upload-analysis`. Original uploaded files are not stored. |
| Dashboard | Reads backend `/dashboard-summary` first. If backend upload activity is empty and cached upload analysis exists, displays the cached result with clear cache wording. |
| Live Visitors | Uses backend in-memory runtime activity from `visitor_tracker`; history resets after backend restart. |
| Upload history | In-memory backend history only for current backend runtime plus local browser cache for current user continuity. |
| Visitor history | In-memory backend runtime only. No DynamoDB or database persistence is implemented or required right now. |
| Model artifacts | Loaded locally or from configured S3 model artifact environment variables. This is artifact loading, not upload-history persistence. |

## 6. Implemented Features

| Feature | Evidence |
| --- | --- |
| Real upload analysis via FastAPI | `Frontend/src/utils/uploadAnalysis.ts`, `Backend/main.py`, `Backend/services/upload_analysis.py` |
| Capped upload preview response | `Backend/services/upload_analysis.py` returns at most `MAX_RETURNED_RECORDS` preview records while keeping aggregate statistics. |
| Upload cache restore and clear | `Frontend/src/utils/uploadAnalysis.ts`, `Frontend/src/components/UploadLogsPage.tsx` |
| Dynamic D3 upload charts | `Frontend/src/components/D3*.tsx`, `Frontend/src/components/UploadLogsPage.tsx` |
| Collapsible prediction context panel | `Frontend/src/components/UploadLogsPage.tsx`, `Frontend/src/styles/global.css` |
| Dashboard backend-first/cache-fallback logic | `Frontend/src/utils/dashboard.ts`, `Frontend/src/components/DashboardPage.tsx` |
| Live Visitors polling and page-view pings | `Frontend/src/utils/liveVisitors.ts`, `Backend/services/visitor_tracker.py` |
| Self-Test real prediction form | `Frontend/src/components/SelfTestPage.tsx`, `Frontend/src/utils/predict.ts` |
| Model metrics endpoint and UI | `Backend/services/predict.py`, `Frontend/src/utils/modelInsights.ts`, `Frontend/src/components/ModelInsightsPage.tsx` |
| Debug endpoint protection | `Backend/main.py` returns `404` unless `ENABLE_DEBUG_ENDPOINTS=true`. |
| Fitted preprocessing artifact support | `Backend/preprocessing_pipeline.json`, `Backend/services/preprocess.py` |
| Manual fallback warning | `Backend/services/preprocess.py`, `Frontend/src/components/UploadLogsPage.tsx` |

## 7. Partially Implemented Features

| Feature | Status | Notes |
| --- | --- | --- |
| Full SHAP explainability | Partial/not implemented | The UI shows traffic context and explicitly states that model-derived SHAP/contribution values are not returned. Do not claim SHAP explainability. |
| Persistent analytics/history | Not implemented by design | Current requirement says no DynamoDB/S3 persistence is required for upload or visitor history. |
| Full upload export of every row | Partial | Frontend exports only returned/cached preview rows. Full export would need a backend paginated/export endpoint. |
| Isolation Forest | Not active | Code has optional loader support, but current project artifacts and current product scope are XGBoost and Random Forest. Do not claim Isolation Forest is deployed unless an artifact is configured and loaded. |
| Upload-based model accuracy | Conditional | Accuracy/precision/recall/F1 are calculated only when labels exist in the uploaded dataset. Otherwise the UI must show prediction distributions only. |

## 8. Not Implemented / Future Work

| Item | Correct report wording |
| --- | --- |
| SHAP feature attribution | “Prediction context is based on model output and traffic features. Full SHAP explainability is future work.” |
| Permanent upload history | “Upload results are stored in browser cache for continuity; server-side persistent history is future work.” |
| Permanent visitor analytics | “Live Visitors reflects current FastAPI runtime activity and page-view pings, not permanent analytics.” |
| Full-row export for very large uploads | “The UI exports the returned preview safely; full dataset export requires a backend export or pagination endpoint.” |
| Isolation Forest deployment | “Current deployed models are XGBoost and Random Forest. Isolation Forest is not claimed as active unless its artifact is loaded.” |

## 9. Dead / Unused Code Candidates

| Candidate | Finding | Action |
| --- | --- | --- |
| `Frontend/src/data/presentationData.ts` | Name sounds static, but it currently contains shared types and one empty-state string, not fake records. | Keep |
| `BarChart.tsx`, `LineChart.tsx`, `PieChart.tsx` | Used directly with aliases such as `D3BarChart`, `D3LineChart`, and `D3PieChart`. | Keep |
| `D3BarChart.tsx`, `D3HistogramChart.tsx`, `D3LineChart.tsx`, `D3PieChart.tsx` | Pure re-export wrappers with no independent logic. Reference search showed only imports that could point directly to the real components. | Deleted |
| `modelInsights.ts` | Used by `ModelInsightsPage.tsx` through named imports. | Keep |
| Optional Isolation Forest constants | Not active without artifact; could be removed if product scope is strictly XGBoost/Random Forest only. | Needs manual review before deletion |
| `Frontend/dist/`, `*.tsbuildinfo`, `.DS_Store` | Not tracked by Git in this workspace. | No source cleanup required |
| CSS classes | Large SOC stylesheet includes many responsive/chart/table states. | Keep unless a CSS coverage tool is added |

## 10. Safe Cleanup Performed

- Created this audit document before modifying implementation code.
- Cleaned Model Insights wording so historical model metadata is not presented as live upload accuracy.
- Deleted pure D3 wrapper re-export files and imported the real D3 chart implementations directly.
- Removed unused frontend upload empty-state constant.
- Removed unused legacy Upload Logs CSS selectors and responsive rules.
- Removed unreferenced backend `analyze_csv_upload` wrapper.
- Kept D3-only chart architecture.
- Kept existing cache, export, tooltip, zoom/pan, filtering, and backend integration code.

## 11. Items Intentionally Kept

- Local browser cache for latest Upload Logs analysis.
- Backend runtime-memory stores for dashboard/upload/live visitor summaries.
- Debug endpoints, because they are disabled unless `ENABLE_DEBUG_ENDPOINTS=true`.
- S3 model artifact loading code, because production App Runner may need it for model/preprocessor artifacts.
- Optional manual preprocessing fallback warning, because it prevents silent misleading predictions if fitted preprocessing cannot load.
- Shared chart components and wrapper exports, because they are used by production pages.

## 12. Remaining Risks / Limitations

- Model performance depends on the deployed model and preprocessing artifacts matching training. `preprocessing.mode` should be checked in production responses.
- If App Runner restarts, backend runtime dashboard/live-visitor memory resets. This is expected under the current no-database requirement.
- Frontend upload export is preview-safe, not a full export for all records in very large files.
- Browser `localStorage` can be cleared by the user/browser; cached upload continuity is not permanent persistence.
- Model Insights metrics come from backend metadata and should be described as historical training/evaluation metrics.
- Real feature-attribution explainability is not implemented unless the backend later returns true model contribution values.
