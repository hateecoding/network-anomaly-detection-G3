# AI4Cyber Network Traffic Anomaly Detection

## Project Overview

This project implements a unified machine-learning pipeline for cybersecurity anomaly detection using multiple network traffic datasets. The main notebook, `FinalVersionV2.ipynb`, cleans and aligns heterogeneous datasets, engineers shared behavioural features, trains several supervised models, and evaluates robustness on an external dataset.

The final prediction task is **binary classification**:

- `0 = Normal traffic`
- `1 = Attack traffic`

Detailed attack labels are preserved during preprocessing for alignment and analysis, but the final saved models predict **normal vs attack**, not the exact attack category.

## Datasets

The notebook uses:

- `datasets/UNSW_NB15_training-set.csv`
- `datasets/KDDTrain+.txt`
- `external_test/basic_data_4.csv`
- `external_test/label_category_map.csv`

Dataset usage:

- `UNSW-NB15` and `NSL-KDD` are harmonized and merged for internal modelling
- `basic_data_4` is reserved for external evaluation only

## Notebook Scope

`FinalVersionV2.ipynb` performs the full workflow:

1. raw dataset loading and inspection
2. data cleaning and schema standardization
3. categorical transformation and label alignment
4. feature engineering
5. dataset merging and exploratory analysis
6. preprocessing and feature selection
7. supervised model training and internal evaluation
8. comparative experiments across datasets, balancing, features, and validation settings
9. external robustness evaluation
10. final recommendation and saved artifacts

## Project Structure

```text
final_FinalVersionV2/
├── FinalVersionV2.ipynb
├── README.md
├── datasets/
│   ├── UNSW_NB15_training-set.csv
│   └── KDDTrain+.txt
├── external_test/
│   ├── basic_data_4.csv
│   └── label_category_map.csv
└── outputs/
    └── final_unified_pipeline/
        ├── processed_datasets/
        │   ├── unsw_nb15_harmonized.csv
        │   ├── nsl_kdd_harmonized.csv
        │   ├── external_basic_data_4_harmonized.csv
        │   └── combined_unsw_nsl_kdd_harmonized.csv
        ├── models/
            ├── logistic_regression.pkl
            ├── k_nearest_neighbors.pkl
            ├── decision_tree.pkl
            ├── random_forest.pkl
            └── xgboost.pkl
```

## Environment Setup

Create and activate a conda environment:

```bash
conda create -n ai4cyber python=3.11 -y
conda activate ai4cyber
```

Install the required packages:

```bash
conda install -c conda-forge -y \
  jupyter \
  notebook \
  pandas \
  numpy \
  matplotlib \
  seaborn \
  scikit-learn \
  imbalanced-learn \
  xgboost \
  joblib \
  ipykernel
```

Optional kernel registration:

```bash
python -m ipykernel install --user --name ai4cyber --display-name "Python (ai4cyber)"
```

## How to Run

From the project folder:

```bash
jupyter notebook
```

Then open:

- `FinalVersionV2.ipynb`

Recommended execution:

- select the `ai4cyber` kernel
- run all cells from top to bottom

This is important because the notebook creates aligned datasets, trained models, figures, and saved artifacts in sequence.

## Data Processing Summary

The notebook prepares all datasets under one shared preprocessing framework so later experiments can be compared fairly. The final dataset choice is made later through modelling evidence, not during the cleaning stage.

Main processing steps:

- standardize column names and categorical text
- assign the raw NSL-KDD schema explicitly
- safely convert numeric fields
- remove non-informative identifiers where needed
- align protocols, services, flags, and attack labels across datasets
- create shared binary labels for anomaly detection
- engineer behavioural features such as:
  - `total_bytes`
  - `byte_ratio`
  - `activity_count`
  - `service_count`
  - `same_service_rate`
  - `destination_host_count`
  - `destination_host_service_count`
- merge harmonized `UNSW-NB15` and `NSL-KDD` into one internal training dataset

Saved processed datasets:

- `outputs/final_unified_pipeline/processed_datasets/unsw_nb15_harmonized.csv`
- `outputs/final_unified_pipeline/processed_datasets/nsl_kdd_harmonized.csv`
- `outputs/final_unified_pipeline/processed_datasets/external_basic_data_4_harmonized.csv`
- `outputs/final_unified_pipeline/processed_datasets/combined_unsw_nsl_kdd_harmonized.csv`

## Modelling Workflow

The supervised modelling pipeline includes:

- median imputation for numeric features
- `RobustScaler` for numeric scaling
- most-frequent imputation for categorical features
- `OneHotEncoder` for categorical variables
- stratified train, validation, and test splitting
- candidate comparison within each model family
- final internal test evaluation
- external testing on `basic_data_4`

Supervised models compared:

- Logistic Regression
- K-Nearest Neighbors
- Decision Tree
- Random Forest
- XGBoost

Supplementary unsupervised method:

- K-Means

## Saved Artifacts

Trained models are saved in:

- `outputs/final_unified_pipeline/models/logistic_regression.pkl`
- `outputs/final_unified_pipeline/models/k_nearest_neighbors.pkl`
- `outputs/final_unified_pipeline/models/decision_tree.pkl`
- `outputs/final_unified_pipeline/models/random_forest.pkl`
- `outputs/final_unified_pipeline/models/xgboost.pkl`

Processed modelling datasets are saved in:

- `outputs/final_unified_pipeline/processed_datasets/unsw_nb15_harmonized.csv`
- `outputs/final_unified_pipeline/processed_datasets/nsl_kdd_harmonized.csv`
- `outputs/final_unified_pipeline/processed_datasets/external_basic_data_4_harmonized.csv`
- `outputs/final_unified_pipeline/processed_datasets/combined_unsw_nsl_kdd_harmonized.csv`


## Final Results

The final internal leaderboard in the notebook ranks the supervised models as follows:

1. `XGBoost`
2. `Random Forest`
3. `Decision Tree`
4. `K-Nearest Neighbors`
5. `Logistic Regression`

Best internal test performer:

- `XGBoost`: Accuracy `0.9677`, F1 `0.8891`, ROC AUC `0.9929`

Main conclusion from the notebook:

- `XGBoost` is the strongest overall supervised model
- `Random Forest` is the closest competitor
- the combined `UNSW-NB15 + NSL-KDD` dataset provides the main internal training base
- the full engineered feature set is more robust than a reduced selected-feature subset
- external evaluation is essential for final model selection

## What the Model Predicts

The saved supervised models predict whether a network traffic record is:

- `0` for normal traffic
- `1` for attack traffic


## Evaluation Metrics

The notebook reports:

- Accuracy
- Precision
- Recall
- F1 Score
- ROC AUC
- False Positive Rate

These metrics are displayed directly inside the notebook during execution.

## Reproducing the Notebook Non-Interactively

To execute the notebook from the terminal:

```bash
jupyter nbconvert --to notebook --execute --inplace FinalVersionV2.ipynb
```

## Troubleshooting

If the notebook kernel fails:

```bash
conda activate ai4cyber
jupyter notebook
```

If a package is missing:

```bash
conda install -c conda-forge -y pandas numpy matplotlib seaborn scikit-learn imbalanced-learn xgboost joblib jupyter notebook ipykernel
```

If the output folders do not exist, rerun the notebook from the beginning. It creates the required directories automatically inside:

- `outputs/final_unified_pipeline/`

## File Relationships

Key workflow links:

- raw input data:
  - `datasets/UNSW_NB15_training-set.csv`
  - `datasets/KDDTrain+.txt`
  - `external_test/basic_data_4.csv`
- processed datasets:
  - `outputs/final_unified_pipeline/processed_datasets/unsw_nb15_harmonized.csv`
  - `outputs/final_unified_pipeline/processed_datasets/nsl_kdd_harmonized.csv`
  - `outputs/final_unified_pipeline/processed_datasets/external_basic_data_4_harmonized.csv`
  - `outputs/final_unified_pipeline/processed_datasets/combined_unsw_nsl_kdd_harmonized.csv`
- saved models:
  - `outputs/final_unified_pipeline/models/*.pkl`

This structure allows the project to be rerun, inspected, and evaluated directly from the notebook. To reuse the saved models for prediction outside the notebook, the same preprocessing steps must be recreated first.
