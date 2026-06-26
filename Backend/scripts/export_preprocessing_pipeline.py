from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys

import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, RobustScaler


SEED = 314159
NUMERIC_FEATURES = [
    "duration",
    "src_bytes",
    "dst_bytes",
    "total_bytes",
    "byte_ratio",
    "activity_count",
    "service_count",
    "same_service_rate",
    "destination_host_count",
    "destination_host_service_count",
]
CATEGORICAL_FEATURES = [
    "protocol_group",
    "service_group",
    "connection_group",
    "service_detail",
    "connection_detail",
]
TRAINING_COLUMNS = NUMERIC_FEATURES + CATEGORICAL_FEATURES


def build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            (
                "num",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", RobustScaler()),
                    ]
                ),
                NUMERIC_FEATURES,
            ),
            (
                "cat",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        (
                            "onehot",
                            OneHotEncoder(
                                handle_unknown="ignore",
                                sparse_output=False,
                            ),
                        ),
                    ]
                ),
                CATEGORICAL_FEATURES,
            ),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def display_path(path: Path, project_root: Path) -> str:
    try:
        return str(path.resolve().relative_to(project_root.resolve()))
    except ValueError:
        return str(path.resolve())


def main() -> int:
    backend_dir = Path(__file__).resolve().parents[1]
    project_root = backend_dir.parent
    parser = argparse.ArgumentParser(
        description="Export the fitted Assignment 2 preprocessing transformer.",
    )
    parser.add_argument(
        "--dataset",
        type=Path,
        default=project_root
        / "datasets"
        / "processed_datasets"
        / "combined_unsw_nsl_kdd_harmonized.csv",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=backend_dir / "preprocessing_pipeline.json",
    )
    args = parser.parse_args()

    expected_features = json.loads(
        (backend_dir / "feature_columns.json").read_text(encoding="utf-8")
    )
    frame = pd.read_csv(args.dataset)
    missing = [
        column
        for column in TRAINING_COLUMNS + ["label_binary"]
        if column not in frame.columns
    ]
    if missing:
        raise ValueError(f"Training dataset is missing columns: {', '.join(missing)}")

    features = frame[TRAINING_COLUMNS].copy()
    labels = frame["label_binary"].astype(int)
    train_features, temporary_features, train_labels, temporary_labels = train_test_split(
        features,
        labels,
        test_size=0.25,
        random_state=SEED,
        stratify=labels,
    )
    train_test_split(
        temporary_features,
        temporary_labels,
        test_size=0.60,
        random_state=SEED,
        stratify=temporary_labels,
    )

    preprocessor = build_preprocessor()
    preprocessor.fit(train_features)
    learned_features = list(preprocessor.get_feature_names_out())
    if learned_features != expected_features:
        raise ValueError(
            "Export aborted because fitted feature names do not match feature_columns.json."
        )

    numeric_pipeline = preprocessor.named_transformers_["num"]
    categorical_pipeline = preprocessor.named_transformers_["cat"]
    numeric_imputer = numeric_pipeline.named_steps["imputer"]
    numeric_scaler = numeric_pipeline.named_steps["scaler"]
    categorical_imputer = categorical_pipeline.named_steps["imputer"]
    onehot_encoder = categorical_pipeline.named_steps["onehot"]
    artifact_payload = {
        "artifact_format": "aegis-net-fitted-preprocessor-v1",
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "numeric_medians": numeric_imputer.statistics_.tolist(),
        "numeric_centers": numeric_scaler.center_.tolist(),
        "numeric_scales": numeric_scaler.scale_.tolist(),
        "categorical_imputations": categorical_imputer.statistics_.tolist(),
        "categories": [
            [str(value) for value in category_values]
            for category_values in onehot_encoder.categories_
        ],
        "feature_names": learned_features,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(artifact_payload, indent=2) + "\n",
        encoding="utf-8",
    )
    metadata_path = args.output.with_name("preprocessing_pipeline_metadata.json")
    metadata_path.write_text(
        json.dumps(
            {
                "artifact": args.output.name,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "dataset": display_path(args.dataset, project_root),
                "dataset_sha256": sha256(args.dataset),
                "dataset_rows": len(frame),
                "training_rows": len(train_features),
                "random_seed": SEED,
                "test_size": 0.25,
                "temporary_test_fraction": 0.60,
                "export_runtime_sklearn_version": sklearn.__version__,
                "feature_count": len(learned_features),
                "feature_names": learned_features,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Exported fitted preprocessing artifact {args.output} ({args.output.stat().st_size} bytes)")
    print(f"Metadata {metadata_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
