from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
import math
import re
from typing import Any

import pandas as pd

from .transform import clean_numeric_value, resolve_canonical_field


SUPPORTED_EXTENSIONS = {".csv", ".xlsx", ".xls"}
MAX_SCAN_ROWS = 500
MAX_SCAN_COLUMNS = 120


@dataclass
class Candidate:
    data: dict[str, float]
    method: str
    sheet: str
    confidence: int
    invalid_fields: set[str]


def _drop_empty(df: pd.DataFrame) -> pd.DataFrame:
    return df.dropna(how="all").dropna(axis=1, how="all").reset_index(drop=True)


def _to_number(value: Any) -> float | None:
    parsed = clean_numeric_value(value)
    if parsed is pd.NA or pd.isna(parsed):
        return None
    try:
        number = float(parsed)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _period_rank(value: Any) -> int:
    if value is None or (not isinstance(value, str) and pd.isna(value)):
        return -1
    if isinstance(value, pd.Timestamp):
        return int(value.timestamp())
    if isinstance(value, (datetime, date)):
        return int(datetime(value.year, value.month, value.day).timestamp())

    text = str(value).translate(str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789"))
    years = [int(match) for match in re.findall(r"\b(?:19|20)\d{2}\b", text)]
    return max(years) if years else -1


def _column_period_rank(df: pd.DataFrame, col_idx: int) -> int:
    ranks = [_period_rank(df.iat[row_idx, col_idx]) for row_idx in range(min(len(df), 30))]
    return max(ranks, default=-1)


def _horizontal_candidate(df: pd.DataFrame, sheet_name: str) -> Candidate | None:
    """Find a header row anywhere, then select the most complete/latest data row."""
    best: tuple[tuple[int, int, int, int], Candidate] | None = None
    row_limit = min(len(df), 80)
    col_limit = min(df.shape[1], MAX_SCAN_COLUMNS)

    for header_idx in range(row_limit):
        mapping: dict[int, str] = {}
        for col_idx in range(col_limit):
            canonical = resolve_canonical_field(df.iat[header_idx, col_idx])
            if canonical:
                mapping[col_idx] = canonical

        # Two fields is enough for statement-specific sheets; accidental matches
        # are filtered by requiring numeric values below the header.
        if len(set(mapping.values())) < 2:
            continue

        for data_idx in range(header_idx + 1, min(len(df), header_idx + 80)):
            data: dict[str, float] = {}
            invalid: set[str] = set()
            for col_idx, canonical in mapping.items():
                raw_value = df.iat[data_idx, col_idx]
                number = _to_number(raw_value)
                if number is not None:
                    data[canonical] = number
                elif raw_value is not None and not pd.isna(raw_value) and str(raw_value).strip():
                    invalid.add(canonical)

            if len(data) < 2:
                continue

            period = max((_period_rank(v) for v in df.iloc[data_idx].tolist()), default=-1)
            confidence = len(data) * 100 + len(set(mapping.values())) * 10
            candidate = Candidate(data, "horizontal_table", sheet_name, confidence, invalid)
            # Prefer more populated rows; for ties prefer latest period then later row.
            rank = (len(data), period, data_idx, len(mapping))
            if best is None or rank > best[0]:
                best = (rank, candidate)

    return best[1] if best else None


def _numeric_positions(row: pd.Series, excluded: set[int]) -> list[tuple[int, float]]:
    positions: list[tuple[int, float]] = []
    for col_idx, value in enumerate(row.tolist()[:MAX_SCAN_COLUMNS]):
        if col_idx in excluded:
            continue
        number = _to_number(value)
        if number is not None:
            positions.append((col_idx, number))
    return positions


def _vertical_candidate(df: pd.DataFrame, sheet_name: str) -> Candidate | None:
    """Read label/value layouts even when columns, rows, or periods are shuffled."""
    label_rows: list[tuple[int, list[tuple[int, str]]]] = []
    col_limit = min(df.shape[1], MAX_SCAN_COLUMNS)

    for row_idx in range(min(len(df), MAX_SCAN_ROWS)):
        labels: list[tuple[int, str]] = []
        for col_idx in range(col_limit):
            canonical = resolve_canonical_field(df.iat[row_idx, col_idx])
            if canonical:
                labels.append((col_idx, canonical))
        if labels:
            label_rows.append((row_idx, labels))

    if len({canonical for _, labels in label_rows for _, canonical in labels}) < 2:
        return None

    # Determine which columns behave like value columns. This supports layouts
    # such as Metric | 2023 | 2024 and chooses the latest equally-complete period.
    value_column_counts: dict[int, int] = {}
    for row_idx, labels in label_rows:
        excluded = {col_idx for col_idx, _ in labels}
        for col_idx, _ in _numeric_positions(df.iloc[row_idx], excluded):
            value_column_counts[col_idx] = value_column_counts.get(col_idx, 0) + 1

    preferred_col: int | None = None
    if value_column_counts:
        preferred_col = max(
            value_column_counts,
            key=lambda col: (value_column_counts[col], _column_period_rank(df, col), col),
        )

    data: dict[str, float] = {}
    invalid: set[str] = set()
    duplicate_values: dict[str, list[float]] = {}

    for row_idx, labels in label_rows:
        label_positions = {col_idx for col_idx, _ in labels}
        numeric_positions = _numeric_positions(df.iloc[row_idx], label_positions)

        for label_col, canonical in labels:
            chosen: float | None = None

            if preferred_col is not None and preferred_col not in label_positions:
                chosen = _to_number(df.iat[row_idx, preferred_col])

            if chosen is None and numeric_positions:
                # For repeated key/value pairs on one row, prefer the nearest
                # number to the right before falling back to the nearest left.
                right = [(col, value) for col, value in numeric_positions if col > label_col]
                left = [(col, value) for col, value in numeric_positions if col < label_col]
                if right:
                    chosen = min(right, key=lambda item: item[0] - label_col)[1]
                elif left:
                    chosen = min(left, key=lambda item: label_col - item[0])[1]

            if chosen is None:
                raw_neighbors = []
                if label_col + 1 < df.shape[1]:
                    raw_neighbors.append(df.iat[row_idx, label_col + 1])
                if label_col - 1 >= 0:
                    raw_neighbors.append(df.iat[row_idx, label_col - 1])
                if any(v is not None and not pd.isna(v) and str(v).strip() for v in raw_neighbors):
                    invalid.add(canonical)
                continue

            duplicate_values.setdefault(canonical, []).append(chosen)
            # The latest preferred period is selected above. Within the same
            # period, keep the last occurrence (typical financial statement total).
            data[canonical] = chosen

    confidence = len(data) * 100 + len(label_rows) * 5
    return Candidate(data, "label_value", sheet_name, confidence, invalid)


def _extract_sheet(df: pd.DataFrame, sheet_name: str) -> list[Candidate]:
    cleaned = _drop_empty(df.iloc[:MAX_SCAN_ROWS, :MAX_SCAN_COLUMNS])
    if cleaned.empty:
        return []

    candidates = []
    horizontal = _horizontal_candidate(cleaned, sheet_name)
    vertical = _vertical_candidate(cleaned, sheet_name)
    if horizontal:
        candidates.append(horizontal)
    if vertical:
        candidates.append(vertical)
    return candidates


def _read_csv(path: Path) -> dict[str, pd.DataFrame]:
    errors: list[str] = []
    for encoding in ("utf-8-sig", "utf-8", "cp1256", "latin1"):
        try:
            df = pd.read_csv(
                path,
                header=None,
                dtype=object,
                sep=None,
                engine="python",
                encoding=encoding,
                keep_default_na=True,
            )
            return {path.stem: df}
        except Exception as exc:  # try next supported encoding/delimiter
            errors.append(f"{encoding}: {exc}")
    raise ValueError("تعذر قراءة ملف CSV. تأكد من سلامة الترميز والفواصل.")


def _read_excel(path: Path) -> dict[str, pd.DataFrame]:
    try:
        return pd.read_excel(path, sheet_name=None, header=None, dtype=object)
    except ImportError as exc:
        if path.suffix.lower() == ".xls":
            raise ValueError("قراءة ملفات .xls تتطلب تثبيت xlrd. استخدم .xlsx أو ثبّت المتطلبات.") from exc
        raise
    except Exception as exc:
        raise ValueError(f"تعذر قراءة ملف Excel: {exc}") from exc


def _materially_different(a: float, b: float) -> bool:
    tolerance = max(abs(a), abs(b), 1.0) * 0.001
    return abs(a - b) > tolerance


def _combine_candidates(candidates: list[Candidate]) -> tuple[dict[str, float], dict[str, Any]]:
    values_by_field: dict[str, list[tuple[float, int, str, str]]] = {}
    invalid_fields: set[str] = set()
    for candidate in candidates:
        invalid_fields.update(candidate.invalid_fields)
        for field, value in candidate.data.items():
            values_by_field.setdefault(field, []).append(
                (value, candidate.confidence, candidate.sheet, candidate.method)
            )

    combined: dict[str, float] = {}
    ambiguous_fields: list[str] = []
    resolved_conflicts: list[dict[str, Any]] = []
    sources: dict[str, dict[str, Any]] = {}

    for field, entries in values_by_field.items():
        entries = sorted(entries, key=lambda item: item[1], reverse=True)
        top_confidence = entries[0][1]
        top_entries = [entry for entry in entries if entry[1] == top_confidence]
        top_values = [entry[0] for entry in top_entries]

        if any(_materially_different(top_values[0], other) for other in top_values[1:]):
            ambiguous_fields.append(field)
            continue

        chosen = entries[0]
        combined[field] = chosen[0]
        sources[field] = {
            "sheet": chosen[2],
            "method": chosen[3],
        }

        lower_conflicts = [
            entry for entry in entries[1:]
            if _materially_different(chosen[0], entry[0])
        ]
        if lower_conflicts:
            resolved_conflicts.append({
                "field": field,
                "chosen_sheet": chosen[2],
                "ignored_sheets": sorted({entry[2] for entry in lower_conflicts}),
            })

    metadata = {
        "recognized_fields": sorted(combined),
        "recognized_count": len(combined),
        "ambiguous_fields": sorted(ambiguous_fields),
        "invalid_numeric_fields": sorted(invalid_fields - set(combined)),
        "resolved_conflicts": resolved_conflicts,
        "used_sheets": sorted({candidate.sheet for candidate in candidates if candidate.data}),
        "methods": sorted({candidate.method for candidate in candidates if candidate.data}),
        "field_sources": sources,
    }
    return combined, metadata


def extract_file(file_path: str) -> pd.DataFrame:
    """
    Read a financial CSV/Excel file without depending on column or sheet order.

    Supported layouts:
    - Horizontal tables with headers on any early row
    - Vertical label/value tables in any column order
    - Multiple sheets with arbitrary names
    - Arabic or English labels and Arabic/English number formats
    - Multi-period files (latest equally-complete period is preferred)
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    ext = path.suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"نوع الملف غير مدعوم: {ext}. الأنواع المدعومة: CSV, XLSX, XLS")

    sheets = _read_csv(path) if ext == ".csv" else _read_excel(path)
    candidates: list[Candidate] = []
    for sheet_name, sheet_df in sheets.items():
        candidates.extend(_extract_sheet(sheet_df, str(sheet_name)))

    combined, metadata = _combine_candidates(candidates)
    if not combined:
        empty = pd.DataFrame()
        empty.attrs["extraction"] = metadata
        return empty

    result = pd.DataFrame([combined])
    result.attrs["extraction"] = metadata
    return result


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        raise SystemExit("Usage: python -m src.elt.extract <financial-file>")
    frame = extract_file(sys.argv[1])
    print(frame.to_string(index=False))
    print(frame.attrs.get("extraction", {}))
