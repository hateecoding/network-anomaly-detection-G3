from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from schemas import TrafficInput

BASE_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BASE_DIR.parent
FEATURE_COLUMNS_CANDIDATES = (
    BASE_DIR / "feature_columns.json",
    BASE_DIR / "anomaly-model-artifacts" / "feature_columns.json",
)

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

DEFAULT_CATEGORICAL_VALUES = {
    "protocol_group": "OTHER",
    "service_group": "OTHER",
    "connection_group": "ERROR",
    "service_detail": "other",
    "connection_detail": "unknown",
}

HEADERLESS_UNSW_RAW_COLUMNS = (
    "srcip",
    "sport",
    "dstip",
    "dsport",
    "proto",
    "state",
    "dur",
    "sbytes",
    "dbytes",
    "sttl",
    "dttl",
    "sloss",
    "dloss",
    "service",
    "sload",
    "dload",
    "spkts",
    "dpkts",
    "swin",
    "dwin",
    "stcpb",
    "dtcpb",
    "smeansz",
    "dmeansz",
    "trans_depth",
    "res_bdy_len",
    "sjit",
    "djit",
    "stime",
    "ltime",
    "sintpkt",
    "dintpkt",
    "tcprtt",
    "synack",
    "ackdat",
    "is_sm_ips_ports",
    "ct_state_ttl",
    "ct_flw_http_mthd",
    "is_ftp_login",
    "ct_ftp_cmd",
    "ct_srv_src",
    "ct_srv_dst",
    "ct_dst_ltm",
    "ct_src_ltm",
    "ct_src_dport_ltm",
    "ct_dst_sport_ltm",
    "ct_dst_src_ltm",
    "attack_cat",
    "label",
)

FIELD_ALIASES = {
    "duration": {"duration", "dur", "session_duration", "flow_duration"},
    "src_bytes": {"src_bytes", "sbytes", "source_bytes", "srcbytes", "bytes_out"},
    "dst_bytes": {"dst_bytes", "dbytes", "destination_bytes", "dstbytes", "bytes_in"},
    "total_bytes": {"total_bytes"},
    "byte_ratio": {"byte_ratio"},
    "activity_count": {"activity_count", "count", "ct_src_ltm"},
    "service_count": {"service_count", "srv_count", "ct_srv_src"},
    "same_service_rate": {"same_service_rate", "same_srv_rate"},
    "destination_host_count": {
        "destination_host_count",
        "dst_host_count",
        "ct_dst_ltm",
    },
    "destination_host_service_count": {
        "destination_host_service_count",
        "dst_host_srv_count",
        "ct_srv_dst",
    },
    "protocol_group": {"protocol_group"},
    "service_group": {"service_group"},
    "connection_group": {"connection_group"},
    "service_detail": {"service_detail"},
    "connection_detail": {"connection_detail"},
    "protocol_raw": {"proto", "protocol_type", "protocol"},
    "service_raw": {"service", "application", "app"},
    "connection_raw": {"state", "flag", "connection_state"},
    "source_ip": {
        "source_ip",
        "srcip",
        "src_ip",
        "sourceip",
        "client_ip",
        "ip_src",
        "src",
    },
    "destination_ip": {
        "destination_ip",
        "dstip",
        "dst_ip",
        "dest_ip",
        "destinationip",
        "server_ip",
        "ip_dst",
        "dst",
    },
    "route": {"route", "path", "url", "endpoint", "uri", "request_path"},
    "attack_name": {"attack_name", "attack_cat"},
    "label": {"label", "attack_cat", "class", "target", "is_attack"},
}

SERVICE_GROUP_MAP = {
    "http": "WEB",
    "http_443": "WEB",
    "ssl": "WEB",
    "ftp": "FILE",
    "ftp-data": "FILE",
    "ftp_data": "FILE",
    "tftp": "FILE",
    "tftp_u": "FILE",
    "smtp": "EMAIL",
    "pop3": "EMAIL",
    "pop_3": "EMAIL",
    "pop_2": "EMAIL",
    "imap4": "EMAIL",
    "dns": "DNS",
    "domain": "DNS",
    "domain_u": "DNS",
    "ssh": "REMOTE",
    "telnet": "REMOTE",
    "kshell": "REMOTE",
    "login": "REMOTE",
    "klogin": "REMOTE",
    "shell": "REMOTE",
    "rje": "REMOTE",
    "exec": "REMOTE",
    "ntp_u": "INFRA",
    "snmp": "INFRA",
    "dhcp": "INFRA",
    "bootpc": "INFRA",
    "tim_i": "INFRA",
    "urp_i": "INFRA",
    "ecr_i": "INFRA",
    "red_i": "INFRA",
    "urh_i": "INFRA",
    "pm_dump": "INFRA",
}

CONNECTION_GROUP_MAP = {
    "sf": "Established",
    "fin": "Established",
    "con": "Established",
    "s0": "Attempted",
    "s1": "Attempted",
    "s2": "Attempted",
    "s3": "Attempted",
    "req": "Attempted",
    "acc": "Attempted",
    "clo": "Attempted",
    "rej": "Rejected",
    "rstos0": "Reset",
    "rsto": "Reset",
    "rstr": "Reset",
    "sh": "Reset",
    "rst": "Reset",
    "rerror": "ERROR",
    "oth": "ERROR",
    "int": "ERROR",
}

ALLOWED_PROTOCOL_GROUPS = {"TCP", "UDP", "ICMP", "OTHER"}
ALLOWED_SERVICE_GROUPS = {"DNS", "EMAIL", "FILE", "INFRA", "OTHER", "REMOTE", "WEB"}
ALLOWED_CONNECTION_GROUPS = {
    "Attempted",
    "ERROR",
    "Established",
    "Rejected",
    "Reset",
}


def clean_column_names(df: pd.DataFrame) -> pd.DataFrame:
    cleaned = df.copy()
    cleaned.columns = [
        str(column).strip().lower().replace("\ufeff", "")
        for column in cleaned.columns
    ]
    return cleaned


def safe_numeric(series: pd.Series) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    return numeric.replace([np.inf, -np.inf], np.nan)


def safe_ratio(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    adjusted_denominator = denominator.replace(0, np.nan)
    return (numerator / adjusted_denominator).replace([np.inf, -np.inf], np.nan)


def group_protocol(value: object) -> str:
    protocol = str(value).strip().lower()
    if protocol == "tcp":
        return "TCP"
    if protocol == "udp":
        return "UDP"
    if protocol == "icmp":
        return "ICMP"
    return "OTHER"


def group_service(value: object) -> str:
    service = str(value).strip().lower()
    return SERVICE_GROUP_MAP.get(service, "OTHER")


def group_connection(value: object) -> str:
    connection = str(value).strip().lower()
    return CONNECTION_GROUP_MAP.get(connection, DEFAULT_CATEGORICAL_VALUES["connection_group"])


def normalize_service_detail(value: object) -> str:
    service = str(value).strip().lower()
    if service in {"", "-", "nan", "none", "unknown"}:
        return "other"
    return service.replace("-", "_")


def normalize_connection_detail(value: object) -> str:
    state = str(value).strip().lower()
    if state in {"", "-", "nan", "none", "unknown"}:
        return "unknown"
    return state


def normalize_protocol_group(value: object) -> str:
    normalized = str(value).strip().upper()
    if normalized in ALLOWED_PROTOCOL_GROUPS:
        return normalized
    return group_protocol(value)


def normalize_service_group(value: object) -> str:
    normalized = str(value).strip().upper()
    if normalized in ALLOWED_SERVICE_GROUPS:
        return normalized
    return group_service(value)


def normalize_connection_group(value: object) -> str:
    normalized = str(value).strip()
    title_case = normalized.title()
    upper_case = normalized.upper()

    if title_case in ALLOWED_CONNECTION_GROUPS:
        return title_case
    if upper_case in ALLOWED_CONNECTION_GROUPS:
        return upper_case
    return group_connection(value)


@lru_cache(maxsize=1)
def get_feature_columns() -> list[str]:
    for path in FEATURE_COLUMNS_CANDIDATES:
        if path.exists():
            with path.open("r", encoding="utf-8") as file:
                return json.load(file)

    raise FileNotFoundError(
        "feature_columns.json was not found in backend/ or backend/anomaly-model-artifacts/."
    )


def _build_source_lookup(raw_df: pd.DataFrame) -> dict[str, str]:
    return {str(column).strip().lower(): column for column in raw_df.columns}


def _series_from_aliases(
    raw_df: pd.DataFrame,
    source_lookup: dict[str, str],
    aliases: set[str],
) -> pd.Series | None:
    for alias in aliases:
        source_column = source_lookup.get(alias)
        if source_column is not None:
            return raw_df[source_column]
    return None


def _text_value(value: object) -> str | None:
    text = str(value).strip()
    if not text or text.lower() in {"nan", "none"}:
        return None
    return text


def _metadata_series(
    raw_df: pd.DataFrame,
    source_lookup: dict[str, str],
    aliases: set[str],
) -> pd.Series:
    source_series = _series_from_aliases(raw_df, source_lookup, aliases)
    if source_series is None:
        return pd.Series([None] * len(raw_df), index=raw_df.index, dtype="object")
    return source_series.map(_text_value)


def _numeric_series(
    raw_df: pd.DataFrame,
    source_lookup: dict[str, str],
    aliases: set[str],
    *,
    default: float = 0.0,
) -> pd.Series:
    source_series = _series_from_aliases(raw_df, source_lookup, aliases)
    if source_series is None:
        return pd.Series(default, index=raw_df.index, dtype="float64")
    return safe_numeric(source_series).fillna(default)


def _text_series(
    raw_df: pd.DataFrame,
    source_lookup: dict[str, str],
    aliases: set[str],
) -> pd.Series | None:
    source_series = _series_from_aliases(raw_df, source_lookup, aliases)
    if source_series is None:
        return None
    return source_series.astype(str).str.strip()


def _validate_raw_network_input(raw_df: pd.DataFrame) -> None:
    cleaned_df = clean_column_names(raw_df)
    source_lookup = _build_source_lookup(cleaned_df)
    required_groups = {
        "duration": FIELD_ALIASES["duration"],
        "source bytes": FIELD_ALIASES["src_bytes"],
        "destination bytes": FIELD_ALIASES["dst_bytes"],
        "activity count": FIELD_ALIASES["activity_count"],
        "service count": FIELD_ALIASES["service_count"],
        "destination host count": FIELD_ALIASES["destination_host_count"],
        "destination host service count": FIELD_ALIASES[
            "destination_host_service_count"
        ],
        "protocol": FIELD_ALIASES["protocol_group"] | FIELD_ALIASES["protocol_raw"],
        "service": FIELD_ALIASES["service_group"] | FIELD_ALIASES["service_raw"],
        "connection state": (
            FIELD_ALIASES["connection_group"] | FIELD_ALIASES["connection_raw"]
        ),
    }
    missing = [
        label
        for label, aliases in required_groups.items()
        if _series_from_aliases(cleaned_df, source_lookup, aliases) is None
    ]
    if missing:
        raise ValueError(
            "Uploaded data is missing required traffic fields: "
            + ", ".join(missing)
            + ". Download the CSV template for the supported schema."
        )

    numeric_groups = {
        "duration": FIELD_ALIASES["duration"],
        "source bytes": FIELD_ALIASES["src_bytes"],
        "destination bytes": FIELD_ALIASES["dst_bytes"],
        "activity count": FIELD_ALIASES["activity_count"],
        "service count": FIELD_ALIASES["service_count"],
        "destination host count": FIELD_ALIASES["destination_host_count"],
        "destination host service count": FIELD_ALIASES[
            "destination_host_service_count"
        ],
    }
    row_errors: list[str] = []
    for label, aliases in numeric_groups.items():
        series = _series_from_aliases(cleaned_df, source_lookup, aliases)
        if series is None:
            continue
        numeric = pd.to_numeric(series, errors="coerce")
        invalid_rows = numeric[numeric.isna()].index.tolist()
        negative_rows = numeric[numeric < 0].index.tolist()
        for row_index in invalid_rows[:3]:
            row_errors.append(f"row {row_index + 2}: {label} must be numeric")
        for row_index in negative_rows[:3]:
            row_errors.append(f"row {row_index + 2}: {label} cannot be negative")

    if row_errors:
        preview = "; ".join(row_errors[:10])
        raise ValueError(f"Uploaded data contains invalid values: {preview}.")


def _canonical_model_input(raw_df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    cleaned_df = clean_column_names(raw_df)
    source_lookup = _build_source_lookup(cleaned_df)

    model_input_df = pd.DataFrame(index=cleaned_df.index)
    context_df = pd.DataFrame(index=cleaned_df.index)

    model_input_df["duration"] = _numeric_series(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["duration"],
    ).clip(lower=0)
    model_input_df["src_bytes"] = _numeric_series(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["src_bytes"],
    ).clip(lower=0)
    model_input_df["dst_bytes"] = _numeric_series(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["dst_bytes"],
    ).clip(lower=0)

    explicit_total_bytes = _series_from_aliases(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["total_bytes"],
    )
    if explicit_total_bytes is None:
        model_input_df["total_bytes"] = (
            model_input_df["src_bytes"] + model_input_df["dst_bytes"]
        )
    else:
        model_input_df["total_bytes"] = safe_numeric(explicit_total_bytes).fillna(
            model_input_df["src_bytes"] + model_input_df["dst_bytes"]
        )

    explicit_byte_ratio = _series_from_aliases(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["byte_ratio"],
    )
    if explicit_byte_ratio is None:
        model_input_df["byte_ratio"] = safe_ratio(
            model_input_df["src_bytes"],
            model_input_df["dst_bytes"],
        ).fillna(0)
    else:
        model_input_df["byte_ratio"] = safe_numeric(explicit_byte_ratio).fillna(
            safe_ratio(model_input_df["src_bytes"], model_input_df["dst_bytes"])
        ).fillna(0)

    model_input_df["activity_count"] = _numeric_series(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["activity_count"],
    ).clip(lower=0)
    model_input_df["service_count"] = _numeric_series(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["service_count"],
    ).clip(lower=0)

    explicit_same_service_rate = _series_from_aliases(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["same_service_rate"],
    )
    if explicit_same_service_rate is None:
        model_input_df["same_service_rate"] = safe_ratio(
            model_input_df["service_count"],
            model_input_df["activity_count"],
        ).fillna(0)
    else:
        model_input_df["same_service_rate"] = safe_numeric(explicit_same_service_rate).fillna(
            safe_ratio(model_input_df["service_count"], model_input_df["activity_count"])
        ).fillna(0)

    destination_host_count = _series_from_aliases(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["destination_host_count"],
    )
    if destination_host_count is None and "count" in source_lookup:
        destination_host_count = cleaned_df[source_lookup["count"]]
    model_input_df["destination_host_count"] = (
        safe_numeric(destination_host_count).fillna(model_input_df["activity_count"])
        if destination_host_count is not None
        else model_input_df["activity_count"]
    ).clip(lower=0)

    destination_host_service_count = _series_from_aliases(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["destination_host_service_count"],
    )
    if destination_host_service_count is None and "srv_count" in source_lookup:
        destination_host_service_count = cleaned_df[source_lookup["srv_count"]]
    model_input_df["destination_host_service_count"] = (
        safe_numeric(destination_host_service_count).fillna(model_input_df["service_count"])
        if destination_host_service_count is not None
        else model_input_df["service_count"]
    ).clip(lower=0)

    protocol_group_series = _text_series(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["protocol_group"],
    )
    if protocol_group_series is None:
        protocol_raw_series = _text_series(
            cleaned_df,
            source_lookup,
            FIELD_ALIASES["protocol_raw"],
        )
        if protocol_raw_series is None:
            protocol_group_series = pd.Series(
                DEFAULT_CATEGORICAL_VALUES["protocol_group"],
                index=cleaned_df.index,
                dtype="object",
            )
        else:
            protocol_group_series = protocol_raw_series.map(normalize_protocol_group)
    else:
        protocol_group_series = protocol_group_series.map(normalize_protocol_group)
    model_input_df["protocol_group"] = protocol_group_series.fillna(
        DEFAULT_CATEGORICAL_VALUES["protocol_group"]
    )

    service_group_series = _text_series(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["service_group"],
    )
    service_raw_series = _text_series(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["service_raw"],
    )
    if service_group_series is None:
        if service_raw_series is None:
            service_group_series = pd.Series(
                DEFAULT_CATEGORICAL_VALUES["service_group"],
                index=cleaned_df.index,
                dtype="object",
            )
        else:
            service_group_series = service_raw_series.map(normalize_service_group)
    else:
        service_group_series = service_group_series.map(normalize_service_group)
    model_input_df["service_group"] = service_group_series.fillna(
        DEFAULT_CATEGORICAL_VALUES["service_group"]
    )

    connection_group_series = _text_series(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["connection_group"],
    )
    connection_raw_series = _text_series(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["connection_raw"],
    )
    if connection_group_series is None:
        if connection_raw_series is None:
            connection_group_series = pd.Series(
                DEFAULT_CATEGORICAL_VALUES["connection_group"],
                index=cleaned_df.index,
                dtype="object",
            )
        else:
            connection_group_series = connection_raw_series.map(normalize_connection_group)
    else:
        connection_group_series = connection_group_series.map(normalize_connection_group)
    model_input_df["connection_group"] = connection_group_series.fillna(
        DEFAULT_CATEGORICAL_VALUES["connection_group"]
    )

    service_detail_series = _text_series(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["service_detail"],
    )
    if service_detail_series is None:
        if service_raw_series is None:
            service_detail_series = pd.Series(
                DEFAULT_CATEGORICAL_VALUES["service_detail"],
                index=cleaned_df.index,
                dtype="object",
            )
        else:
            service_detail_series = service_raw_series.map(normalize_service_detail)
    else:
        service_detail_series = service_detail_series.map(normalize_service_detail)
    model_input_df["service_detail"] = service_detail_series.fillna(
        DEFAULT_CATEGORICAL_VALUES["service_detail"]
    )

    connection_detail_series = _text_series(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["connection_detail"],
    )
    if connection_detail_series is None:
        if connection_raw_series is None:
            connection_detail_series = pd.Series(
                DEFAULT_CATEGORICAL_VALUES["connection_detail"],
                index=cleaned_df.index,
                dtype="object",
            )
        else:
            connection_detail_series = connection_raw_series.map(normalize_connection_detail)
    else:
        connection_detail_series = connection_detail_series.map(normalize_connection_detail)
    model_input_df["connection_detail"] = connection_detail_series.fillna(
        DEFAULT_CATEGORICAL_VALUES["connection_detail"]
    )

    context_df["duration"] = model_input_df["duration"]
    for column in NUMERIC_FEATURES:
        context_df[column] = model_input_df[column]
    context_df["protocol"] = (
        _metadata_series(cleaned_df, source_lookup, FIELD_ALIASES["protocol_raw"])
        .fillna(model_input_df["protocol_group"])
        .astype(object)
    )
    context_df["service"] = (
        _metadata_series(cleaned_df, source_lookup, FIELD_ALIASES["service_raw"])
        .fillna(model_input_df["service_detail"])
        .astype(object)
    )
    context_df["source_ip"] = _metadata_series(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["source_ip"],
    )
    context_df["destination_ip"] = _metadata_series(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["destination_ip"],
    )
    context_df["route"] = _metadata_series(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["route"],
    )

    attack_name_series = _metadata_series(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["attack_name"],
    )
    if attack_name_series.isna().all():
        label_series = _series_from_aliases(cleaned_df, source_lookup, FIELD_ALIASES["label"])
        if label_series is not None and not pd.api.types.is_numeric_dtype(label_series):
            attack_name_series = label_series.map(_text_value)
    context_df["attack_name"] = attack_name_series
    context_df["label"] = _metadata_series(
        cleaned_df,
        source_lookup,
        FIELD_ALIASES["label"],
    )

    return model_input_df[TRAINING_COLUMNS], context_df


def align_features(df_incoming: pd.DataFrame) -> pd.DataFrame:
    expected_features = get_feature_columns()
    aligned_df = df_incoming.copy()

    for column in expected_features:
        if column not in aligned_df.columns:
            aligned_df[column] = 0.0

    return aligned_df[expected_features].fillna(0.0)


def encode_features(model_input_df: pd.DataFrame) -> pd.DataFrame:
    encoded_df = pd.DataFrame(index=model_input_df.index)

    for column in NUMERIC_FEATURES:
        encoded_df[column] = safe_numeric(model_input_df[column]).fillna(0.0)

    for column in CATEGORICAL_FEATURES:
        values = model_input_df[column].fillna(DEFAULT_CATEGORICAL_VALUES[column]).astype(str)
        dummies = pd.get_dummies(values, prefix=column, dtype=float)
        encoded_df = pd.concat([encoded_df, dummies], axis=1)

    return align_features(encoded_df).astype(float)


def apply_known_headerless_schema(raw_df: pd.DataFrame) -> pd.DataFrame:
    if len(raw_df.columns) == len(HEADERLESS_UNSW_RAW_COLUMNS):
        headerless_df = raw_df.copy()
        headerless_df.columns = list(HEADERLESS_UNSW_RAW_COLUMNS)
        return headerless_df

    raise ValueError(
        "Uploaded data does not contain headers and does not match the supported 49-column UNSW-NB15 raw format."
    )


def prepare_batch_input(raw_df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    _validate_raw_network_input(raw_df)
    model_input_df, context_df = _canonical_model_input(raw_df)

    processed_df = encode_features(model_input_df)
    return processed_df, context_df


def prepare_single_record(
    record: TrafficInput | dict[str, Any],
) -> tuple[pd.DataFrame, dict[str, object]]:
    payload = record.model_dump() if isinstance(record, TrafficInput) else dict(record)
    processed_df, context_df = prepare_batch_input(pd.DataFrame([payload]))
    return processed_df, context_df.iloc[0].to_dict()
