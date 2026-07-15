# src/elt/pipeline.py
from __future__ import annotations
import json
import sys
import math
from pathlib import Path

import pandas as pd

from .extract import extract_file
from .transform import transform_financial_data
from .validate import validate_required_fields, validate_financial_logic
from .metrics import calculate_financial_metrics
from .dashboard_formatter import format_dashboard_metrics
from .scoring import build_scoring_output


def _json_safe(value):
    """Convert pandas/numpy values to JSON-safe Python primitives."""
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]
    if hasattr(value, "item"):
        try:
            return _json_safe(value.item())
        except Exception:
            pass
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


def run_pipeline(file_path: str) -> dict:
    raw_df = extract_file(file_path)
    extraction = dict(raw_df.attrs.get("extraction", {}))
    processed_df = transform_financial_data(raw_df)

    input_name = Path(file_path).stem
    processed_dir = Path("data/processed")
    processed_dir.mkdir(parents=True, exist_ok=True)

    processed_file = processed_dir / f"{input_name}_processed.csv"
    processed_df.to_csv(processed_file, index=False)

    validation = validate_required_fields(
        processed_df,
        min_coverage=1.00,
        require_all_statements=True
    )

    ambiguous_fields = extraction.get("ambiguous_fields", [])
    invalid_numeric_fields = extraction.get("invalid_numeric_fields", [])
    validation["ambiguous_fields"] = ambiguous_fields
    validation["invalid_numeric_fields"] = invalid_numeric_fields

    if ambiguous_fields:
        validation["is_valid"] = False
        validation["reasons"].append(
            "توجد قيم متعارضة لنفس الحقول في الملف، لذلك لم يتم اختيار قيمة قد تنتج حسابات غير صحيحة: "
            + ", ".join(ambiguous_fields)
        )

    logic_validation = validate_financial_logic(processed_df)

    if not validation["is_valid"]:
        return {
            "status": "invalid",
            "message": "الملف المالي غير مكتمل أو لا يحتوي على بيانات كافية للتحليل.",
            "processed_file": str(processed_file),
            "validation": validation,
            "extraction": _json_safe(extraction),
            "logic_validation": logic_validation,
            "cleaned_data": _json_safe(processed_df.iloc[0].to_dict()) if not processed_df.empty else {},
            "metrics": {},
            "dashboard": {},
            "scoring": {}
        }

    metrics = calculate_financial_metrics(processed_df)
    dashboard = format_dashboard_metrics(metrics)

    raw_data = processed_df.iloc[0].to_dict()
    scoring = build_scoring_output(raw_data, metrics)

    logic_issues = logic_validation.get("issues", [])
    logic_warnings = logic_validation.get("warnings", [])

    if logic_issues:
        status = "warning"
        message = (
            "تمت قراءة الملف واستخراج المؤشرات، لكن توجد مشكلات منطقية "
            "في البيانات المالية ويجب مراجعتها قبل الاعتماد على التحليل."
        )
    elif logic_warnings:
        status = "valid_with_warnings"
        message = (
            "تم فحص الملف المالي واستخراج المؤشرات بنجاح، مع وجود بعض "
            "الملاحظات التي يُفضّل مراجعتها."
        )
    else:
        status = "valid"
        message = "تم فحص الملف المالي واستخراج المؤشرات بنجاح."

    return {
        "status": status,
        "message": message,
        "processed_file": str(processed_file),
        "validation": validation,
        "extraction": _json_safe(extraction),
        "logic_validation": logic_validation,
        "cleaned_data": _json_safe(raw_data),
        "metrics": _json_safe(metrics),
        "dashboard": _json_safe(dashboard),
        "scoring": _json_safe(scoring)
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        result = {
            "status": "error",
            "message": (
                "يرجى تمرير مسار الملف المالي. مثال: "
                "python -m src.elt.pipeline data/raw/financial_data.csv"
            )
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)

    file_path = sys.argv[1]

    try:
        result = run_pipeline(file_path)
        print(json.dumps(result, ensure_ascii=False))
    except FileNotFoundError:
        print(json.dumps({
            "status": "error",
            "message": f"الملف غير موجود: {file_path}"
        }, ensure_ascii=False))
        sys.exit(1)
    except ValueError as e:
        print(json.dumps({
            "status": "error",
            "message": str(e)
        }, ensure_ascii=False))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({
            "status": "error",
            "message": f"حدث خطأ أثناء معالجة الملف: {str(e)}"
        }, ensure_ascii=False))
        sys.exit(1)