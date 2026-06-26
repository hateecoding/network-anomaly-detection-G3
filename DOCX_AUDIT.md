# DOCX AUDIT RESULT

Source reviewed: `things to add and fix.docx` from `/Users/jensenjianxi/Downloads/`.

Status reflects the codebase after the safe fixes in this audit.

| Requirement / issue from DOCX | Status | Evidence | What still needs fixing | Priority |
| --- | --- | --- | --- | --- |
| Complete fitted preprocessing pipeline | Implemented | `Backend/preprocessing_pipeline.json`, `Backend/services/preprocess.py`, exporter metadata | Keep the artifact and App Runner environment synchronized; do not refit during requests. | Critical |
| Fitted imputer deployed | Implemented | Artifact stores numeric medians and categorical most-frequent values | None. | Critical |
| Fitted RobustScaler deployed | Implemented | Artifact stores fitted centers/scales; verified against sklearn output with zero numerical difference | None. | Critical |
| Fitted OneHotEncoder deployed | Implemented | Artifact stores fitted categories and unknown values map to all-zero category vectors | None. | Critical |
| Fixed model feature order | Implemented | `Backend/feature_columns.json`, `align_features()` | Keep this file packaged with any replacement Pipeline for diagnostics. | Critical |
| Unknown categorical handling | Implemented | Fitted artifact reproduces `OneHotEncoder(handle_unknown="ignore")` | None. | Critical |
| XGBoost and Random Forest are standalone classifiers | Implemented/confirmed | Artifact inspection: `XGBClassifier` and `RandomForestClassifier`, both with 67 inputs and no pipeline steps | Replace with complete fitted pipelines. | Critical |
| Production accuracy verified after preprocessing | Partially implemented | Labelled held-out upload evaluation reproduces Random Forest metrics and XGBoost ROC-AUC | The original tuned XGBoost classification threshold is absent, so default-threshold XGBoost precision/F1 differ from archived values. | Critical |
| Upload charts hidden before successful upload | Implemented | `Frontend/src/components/UploadLogsPage.tsx` uses `hasAnalysis` gating | None. | HD required |
| Charts use uploaded data and prediction output | Implemented | Full-data backend aggregates in `Backend/services/upload_analysis.py`; preview-row charts in Upload Logs | Scatter plot is limited to the returned 1,000-row preview by design. | HD required |
| Review recommended is not a model class | Implemented | `Backend/services/classification.py`; row fields `model_prediction` and `display_category` | Keep this distinction in report wording. | Critical |
| Replace user-facing Suspicious terminology | Implemented for upload model output | Upload UI uses Review Recommended; backend upload schema uses `review_recommended_*` | Internal visitor monitoring still uses “suspicious” as a request-rule flag, not an AI model class. | HD required |
| Centralized thresholds | Implemented | `Backend/services/classification.py`; thresholds returned by `/upload-log` | None. Frontend threshold duplication was removed. | Critical |
| Backend returns row traffic fields | Implemented | `UploadRecordResult` in `Backend/schemas.py` and response construction in `upload_analysis.py` | Only capped preview rows are returned, intentionally. | HD required |
| Prediction distribution donut | Partially implemented | `PieChart.tsx`, `UploadLogsPage.tsx` | Tooltip, click filtering, legend and reset exist; animated transitions are still missing. | HD required |
| Grouped anomaly-risk trend | Partially implemented | `D3RiskTrendChart.tsx`; backend average/max probability and attack counts | Horizontal zoom/brush and chart PNG export are missing. | HD required |
| Interactive traffic-feature scatter plot | Partially implemented | `D3ScatterPlot.tsx` | Axis selectors, zoom/pan, hover title and row selection exist; full detail modal and PNG export are missing. | HD required |
| Protocol risk comparison | Partially implemented | `D3ProtocolRiskChart.tsx` | Stacked categories, attack rate and click filters exist; user-selectable sorting is missing. | HD required |
| Attack-probability distribution | Partially implemented | Upload Logs probability histogram uses backend attack probabilities | Click filtering and risk colours exist; threshold markers and PNG export are missing. | HD required |
| Shared chart/table filtering | Partially implemented | Upload page protocol, category, probability and row-range filters update the table/scatter | Full-data aggregate charts do not all recompute from the capped preview. Server-side filtered aggregates would be needed. | HD required |
| D3 only and locally installed | Implemented | `Frontend/package.json`, D3 imports in chart components, CDN removed from `index.html` | None. | HD required |
| Confusion matrix heatmap | Implemented when labels exist | `D3HeatmapChart.tsx`, Upload Logs model analysis | Hidden correctly when ground-truth labels are absent. | HD required |
| Manual form matches real harmonized features | Implemented | `SelfTestPage.tsx`, `utils/predict.ts`, `TrafficInput`, fitted preprocessing artifact | None. | Critical |
| Manual form validation | Implemented | Required fields, ranges, inline errors, disabled submit; Pydantic constraints | Consider domain-specific upper limits for all count/byte fields. | Critical |
| Upload validation | Partially implemented | Required aliases, numeric/non-negative checks, file size, row cap, empty/format errors | Categorical-value validation and a downloadable validation report for all invalid rows are not implemented. | Critical |
| Upload template | Implemented | `exportCsvTemplate()` contains the 15 harmonized columns | None. | HD required |
| Binary prediction terminology | Implemented | No attack-family prediction card; model output is Normal/Attack | Dataset labels remain evaluation inputs only. | Critical |
| Review row must not display SAFE | Implemented | `mapUploadRow()` returns `REVIEW RECOMMENDED` | None. | Critical |
| Live Visitors described accurately | Implemented | `LiveVisitorsPage.tsx`, `README.md` describe FastAPI activity/page-view pings | It is not packet capture and must not be reported as network traffic monitoring. | Critical |
| Simulated live traffic mode | Not implemented | No simulation controls or sample prediction timer | Optional; requires a clear product decision because earlier production requirements removed simulated data. | Nice to have |
| Real model explainability | Not implemented | No SHAP/feature-contribution artifact or endpoint | Export real SHAP/importance evidence from the fitted model. Do not generate guessed explanations. | HD required |
| CSV/JSON exports | Partially implemented | Filtered preview CSV and JSON export in `uploadAnalysis.ts` | Full 178k-row export needs a paginated/server-generated export endpoint; PNG and summary export remain missing. | Nice to have |
| Dependency locking | Partially implemented | Frontend lockfile and pinned direct backend requirements | Generate a reproducible backend lock with the exact training/runtime versions and retest model loading. | Critical |
| README/environment setup | Implemented | `README.md`, `Backend/.env.example`, `Frontend/.env.example` | Keep deployed URLs and S3 prefixes synchronized with infrastructure. | HD required |
| Debug endpoint protection | Implemented | `ENABLE_DEBUG_ENDPOINTS=false` gate in `Backend/main.py` | Confirm the production App Runner variable remains false/unset. | Critical |
| Internal exception details hidden | Implemented | Generic production responses in `Backend/main.py`; details only when debug enabled | Server logs still contain technical details, as intended. | Critical |
| Backend tests | Partially implemented | `Backend/tests/test_preprocess.py` | Add endpoint tests, upload contract tests, and model-artifact integration tests. | HD required |
| Frontend tests | Not implemented | No Vitest/React Testing Library suite | Add component and normalization tests. | HD required |
| Responsive layout | Partially implemented | Responsive CSS and successful production build | Automated browser verification was blocked by the local browser policy; manually capture desktop/tablet/mobile evidence. | HD required |
| Persistent prediction history | Partially implemented | Upload result persists in browser localStorage; backend history is in memory | Add durable database/S3 storage only if required by scope and privacy policy. | Nice to have |
| XGBoost/Random Forest comparison | Implemented | Per-model upload analysis and model comparison UI | Add an explicit agreement/disagreement count/chart if required. | Nice to have |
| Isolation Forest | Not implemented in current artifacts | Loader supports an optional filename, but no artifact is present | Do not claim it is deployed. | Nice to have |

# SAFE FIXES IMPLEMENTED

- Centralized Review and Attack thresholds in the backend.
- Added explicit binary `model_prediction` and application-level `display_category`.
- Returned the required harmonized traffic features for preview rows.
- Replaced confidence-based upload aggregation with attack-probability aggregation.
- Added full-upload grouped risk statistics and protocol risk statistics.
- Added interactive D3 risk trend, protocol risk, and scatter charts.
- Connected category, protocol, probability, row-range, and point selections to the preview table.
- Corrected Review Recommended rows so they no longer display SAFE.
- Split dashboard Normal, Review Recommended, and Attack counts.
- Replaced the synthetic manual form with the actual 15 harmonized input features.
- Strengthened frontend and backend validation.
- Added JSON export and model/timestamp metadata to CSV export.
- Installed and locked D3 locally and removed the D3 CDN dependency.
- Protected production error details and retained the debug endpoint gate.
- Added backend preprocessing/classification regression tests.
- Replaced the outdated notebook README with production setup, environment, endpoint, limitation, and verification documentation.
- Exported and deployed the fitted Assignment 2 preprocessing parameters.
- Added explicit preprocessing mode/warning metadata to prediction responses.

# NOT FIXED / NEEDS DECISION

- The original notebook and serialized tuned XGBoost decision threshold are absent. The recovered fitted preprocessing is verified, but the historical XGBoost threshold should not be guessed silently.
- Real SHAP or feature-contribution explainability requires model evidence/artifacts.
- Full-result export requires a backend export job or paginated endpoint because `/upload-log` intentionally returns only 1,000 rows.
- Chart PNG export, animated transitions, protocol sorting, full detail modal, and full cross-chart recomputation remain incomplete.
- Simulated Live Traffic was not added because it conflicts with the production requirement to remove simulated activity unless explicitly separated and approved.
- Frontend automated tests and browser-based responsive evidence are still required.
- The local virtual environment uses scikit-learn 1.6.1 while the Random Forest artifact reports scikit-learn 1.8.0. Rebuild the environment from the pinned requirements and retest before deployment.
