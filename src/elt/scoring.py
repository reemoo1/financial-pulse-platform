# src/elt/scoring.py
"""Transparent credit-policy scoring shared with lib/financial.ts.

The values produced here are decision-support estimates. A regulatory bank PD
must be calibrated on the lender's own observed defaults and governance process.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

_MODEL_PATH = Path(__file__).resolve().parents[2] / "config" / "financial-model.json"
with _MODEL_PATH.open("r", encoding="utf-8") as model_file:
    _MODEL = json.load(model_file)

SECTOR_VISION_WEIGHTS = _MODEL["sectorVisionWeights"]
SECTOR_BENCHMARKS = {
    sector: {
        "avg_current_ratio": values["liquidityRatio"],
        "avg_debt_ratio": values["debtRatio"],
        "avg_profit_margin": values["profitMargin"],
    }
    for sector, values in _MODEL["benchmarks"].items()
}


def _clamp(n, lo, hi):
    return min(hi, max(lo, n))


def _js_round(n):
    """Match JavaScript Math.round for non-negative model outputs."""
    return math.floor(n + 0.5)


def _score_linear(value, weak, strong, lower_is_better=False):
    if value is None or not math.isfinite(float(value)):
        return 50.0
    value = float(value)
    if lower_is_better:
        if value <= strong:
            return 100.0
        if value >= weak:
            return 0.0
        return _clamp(100 - ((value - strong) / (weak - strong)) * 100, 0, 100)
    if value >= strong:
        return 100.0
    if value <= weak:
        return 0.0
    return _clamp(((value - weak) / (strong - weak)) * 100, 0, 100)


def _weighted_available(items):
    available = [(score, weight) for value, score, weight in items if value is not None]
    weight = sum(w for _, w in available)
    if not weight:
        return {"score": 0.0, "available": False}
    return {
        "score": sum(score * w for score, w in available) / weight,
        "available": True,
    }


def calculate_health_score(raw_data: dict, metrics: dict) -> dict:
    liquidity = _weighted_available([
        (metrics.get("current_ratio"), _score_linear(metrics.get("current_ratio"), 0.7, 2.0), 0.5),
        (metrics.get("quick_ratio"), _score_linear(metrics.get("quick_ratio"), 0.5, 1.5), 0.3),
        (metrics.get("cash_ratio"), _score_linear(metrics.get("cash_ratio"), 0.05, 0.5), 0.2),
    ])
    leverage = _weighted_available([
        (metrics.get("debt_ratio"), _score_linear(metrics.get("debt_ratio"), 0.8, 0.3, True), 0.7),
        (metrics.get("debt_to_equity"), _score_linear(metrics.get("debt_to_equity"), 3.0, 0.7, True), 0.3),
    ])
    profitability = _weighted_available([
        (metrics.get("net_profit_margin"), _score_linear(metrics.get("net_profit_margin"), 0.0, 0.15), 0.4),
        (metrics.get("operating_margin"), _score_linear(metrics.get("operating_margin"), 0.0, 0.18), 0.3),
        (metrics.get("roa"), _score_linear(metrics.get("roa"), 0.0, 0.12), 0.3),
    ])
    debt_service = _weighted_available([
        (metrics.get("dscr"), _score_linear(metrics.get("dscr"), 0.8, 1.75), 0.65),
        (metrics.get("interest_coverage"), _score_linear(metrics.get("interest_coverage"), 1.0, 5.0), 0.35),
    ])
    revenue = raw_data.get("revenue")
    fcf = metrics.get("free_cash_flow")
    fcf_margin = None if revenue in (None, 0) or fcf is None else fcf / revenue
    cash_flow = _weighted_available([
        (metrics.get("operating_cash_flow_ratio"), _score_linear(metrics.get("operating_cash_flow_ratio"), 0.1, 1.0), 0.45),
        (metrics.get("operating_cash_flow_to_debt"), _score_linear(metrics.get("operating_cash_flow_to_debt"), 0.05, 0.35), 0.35),
        (fcf_margin, _score_linear(fcf_margin, -0.05, 0.1), 0.2),
    ])
    distress_available = metrics.get("altman_model") == "private_full" and metrics.get("altman_z_score") is not None
    distress = _score_linear(metrics.get("altman_z_score"), 1.23, 2.9) if distress_available else 0

    definitions = [
        ("liquidity", "السيولة", liquidity["score"], 0.15, liquidity["available"]),
        ("leverage", "الرافعة المالية", leverage["score"], 0.20, leverage["available"]),
        ("profitability", "الربحية", profitability["score"], 0.15, profitability["available"]),
        ("debt_service", "خدمة الدين", debt_service["score"], 0.20, metrics.get("dscr") is not None),
        ("cash_flow", "التدفق النقدي", cash_flow["score"], 0.15, cash_flow["available"]),
        ("distress", "مؤشر التعثر", distress, 0.15, distress_available),
    ]
    available_weight = sum(weight for _, _, _, weight, available in definitions if available)
    components = []
    for key, label, score, base_weight, available in definitions:
        effective_weight = base_weight / available_weight if available and available_weight else 0
        components.append({
            "key": key,
            "label": label,
            "score": _js_round(score) if available else 0,
            "weight": effective_weight,
            "contribution": round(score * effective_weight, 2) if available else 0,
            "available": available,
        })
    health_score = _clamp(_js_round(sum(c["contribution"] for c in components)), 0, 100)
    return {"health_score": health_score, "components": components}


def calculate_default_probability(raw_data: dict, metrics: dict, health_score: float) -> float:
    logit = -4.5 + 0.08 * (100 - health_score)
    z_score = metrics.get("altman_z_score")
    if z_score is not None and metrics.get("altman_model") == "private_full":
        if z_score < 1.23:
            logit += 1.0
        elif z_score < 2.9:
            logit += 0.25
        else:
            logit -= 0.2
    dscr = metrics.get("dscr")
    if dscr is not None:
        if dscr < 1:
            logit += 0.8
        elif dscr < 1.25:
            logit += 0.35
    net_income = raw_data.get("net_income")
    if net_income is not None and net_income < 0:
        logit += 0.5
    pd = 100 / (1 + math.exp(-logit))
    return round(_clamp(pd, 0.5, 95), 1)


def calculate_risk_level(metrics: dict, raw_data: dict | None = None) -> str:
    raw_data = raw_data or {}
    health = calculate_health_score(raw_data, metrics)
    pd = calculate_default_probability(raw_data, metrics, health["health_score"])
    if pd <= 10:
        return "Low"
    if pd <= 30:
        return "Medium"
    return "High"


def calculate_interest_rate(risk_level: str, default_probability=10.0, debt_ratio=None, interest_coverage=None) -> float:
    debt_premium = max((debt_ratio if debt_ratio is not None else 0.45) - 0.45, 0) * 5
    coverage_premium = 0.75 if interest_coverage is not None and interest_coverage < 3 else 0
    risk_premium = _clamp(1.25 + default_probability * 0.07 + debt_premium + coverage_premium, 1, 9)
    return round(_clamp(4.0 + risk_premium, 5, 14), 2)


def _pv_from_payment(monthly_payment, annual_rate, months):
    if monthly_payment <= 0 or months <= 0:
        return 0.0
    monthly_rate = annual_rate / 12
    if monthly_rate == 0:
        return monthly_payment * months
    return monthly_payment * ((1 - (1 + monthly_rate) ** (-months)) / monthly_rate)


def calculate_recommended_financing(raw_data: dict, metrics: dict, risk_level: str, default_probability: float) -> dict:
    target_dscr = 1.35 if risk_level == "Low" else 1.5 if risk_level == "Medium" else 1.75
    months = 60 if risk_level == "Low" else 48 if risk_level == "Medium" else 36
    interest_rate = calculate_interest_rate(
        risk_level,
        default_probability,
        metrics.get("debt_ratio"),
        metrics.get("interest_coverage"),
    )
    cfads = metrics.get("cfads")
    existing_service = metrics.get("contractual_debt_service")
    required_inputs = [
        raw_data.get("scheduled_principal"),
        raw_data.get("scheduled_interest"),
        raw_data.get("mandatory_debt_fees"),
        raw_data.get("finance_lease_payments"),
    ]
    complete = cfads is not None and existing_service is not None and existing_service > 0 and all(v is not None for v in required_inputs)
    available_service = max(cfads / target_dscr - existing_service, 0) if complete else None
    cash_capacity = _pv_from_payment(round(available_service / 12), interest_rate / 100, months) if available_service is not None else None

    assets = raw_data.get("total_assets")
    liabilities = raw_data.get("total_liabilities")
    net_assets = max(assets - liabilities, 0) if assets is not None and liabilities is not None else None
    multiplier = 0.7 if risk_level == "Low" else 0.5 if risk_level == "Medium" else 0.3
    asset_capacity = net_assets * multiplier if net_assets is not None else None

    max_debt_ratio = 0.65 if risk_level == "Low" else 0.60 if risk_level == "Medium" else 0.55
    leverage_capacity = None
    if assets is not None and liabilities is not None:
        leverage_capacity = max((max_debt_ratio * assets - liabilities) / (1 - max_debt_ratio), 0)

    revenue = raw_data.get("revenue")
    revenue_multiplier = 0.25 if risk_level == "Low" else 0.18 if risk_level == "Medium" else 0.10
    revenue_capacity = max(revenue * revenue_multiplier, 0) if revenue is not None else None

    capacities = {
        "cash_flow_capacity": cash_capacity,
        "asset_backed_capacity": asset_capacity,
        "leverage_capacity": leverage_capacity,
        "revenue_capacity": revenue_capacity,
    }
    usable = [(key, value) for key, value in capacities.items() if value is not None and math.isfinite(value)]
    binding_key, binding_value = min(usable, key=lambda item: item[1]) if complete and usable else ("banking_debt_service_data_missing", 0)
    amount = max(math.floor(binding_value / 50_000) * 50_000, 0) if complete else 0
    return {
        "amount": amount,
        "interest_rate": interest_rate,
        "term_months": months,
        "target_dscr": target_dscr,
        "existing_annual_debt_service": None if existing_service is None else round(existing_service),
        "available_annual_debt_service": None if available_service is None else round(available_service),
        "cfads": None if cfads is None else round(cfads),
        "debt_service_data_complete": complete,
        "binding_constraint": binding_key,
        **{key: None if value is None else round(value) for key, value in capacities.items()},
    }


def _percent(value):
    if value is None:
        return None
    try:
        return _clamp(float(value), 0, 100)
    except (TypeError, ValueError):
        return None


def _non_negative(value):
    if value is None:
        return None
    try:
        return max(float(value), 0)
    except (TypeError, ValueError):
        return None


def calculate_vision_2030_score(raw_data: dict, metrics: dict, employee_count=None) -> dict:
    sector = raw_data.get("sector", "أخرى")
    sector_weight = SECTOR_VISION_WEIGHTS.get(sector, SECTOR_VISION_WEIGHTS["أخرى"])
    liquidity_score = _score_linear(metrics.get("current_ratio"), 0.7, 2.0)
    debt_score = _score_linear(metrics.get("debt_ratio"), 0.8, 0.3, True)
    profitability_score = _score_linear(metrics.get("net_profit_margin"), 0.0, 0.15)
    cash_flow_score = _score_linear(metrics.get("operating_cash_flow_ratio"), 0.1, 1.0)
    financial_stability = _js_round((liquidity_score + debt_score + profitability_score + cash_flow_score) / 4)

    employees = _non_negative(raw_data.get("employee_count", employee_count))
    saudis = _non_negative(raw_data.get("saudi_employee_count"))
    planned_jobs = _non_negative(raw_data.get("planned_new_jobs"))
    local_procurement = _percent(raw_data.get("local_procurement_percent"))
    non_oil_revenue = _percent(raw_data.get("non_oil_revenue_percent"))
    sustainability_input = _percent(raw_data.get("sustainability_score"))

    has_localization = employees is not None and employees > 0 and saudis is not None
    localization = (
        _clamp(_js_round((saudis / employees) * 100), 0, 100)
        if has_localization
        else _clamp(_js_round(sector_weight * 0.55 + financial_stability * 0.45), 0, 100)
    )

    has_non_oil = non_oil_revenue is not None or local_procurement is not None
    if has_non_oil:
        if non_oil_revenue is not None and local_procurement is not None:
            non_oil = _js_round(non_oil_revenue * 0.7 + local_procurement * 0.3)
        else:
            non_oil = _js_round(non_oil_revenue if non_oil_revenue is not None else local_procurement)
    else:
        non_oil = _clamp(_js_round(sector_weight * 0.7 + profitability_score * 0.2 + debt_score * 0.1), 0, 100)

    has_sustainability = sustainability_input is not None
    sustainability = (
        _clamp(_js_round(sustainability_input * 0.75 + cash_flow_score * 0.15 + debt_score * 0.1), 0, 100)
        if has_sustainability
        else _clamp(_js_round(sector_weight * 0.35 + cash_flow_score * 0.4 + debt_score * 0.25), 0, 100)
    )

    has_jobs = employees is not None and planned_jobs is not None
    job_creation = (
        _clamp(_js_round(30 + (min(planned_jobs / max(employees, 1), 0.25) / 0.25) * 70), 0, 100)
        if has_jobs
        else _clamp(_js_round(35 + financial_stability * 0.35 + sector_weight * 0.25), 0, 100)
    )

    total_score = _js_round(localization * 0.25 + non_oil * 0.3 + sustainability * 0.25 + job_creation * 0.2)
    actual_inputs = sum(value is not None for value in [employees, saudis, planned_jobs, local_procurement, non_oil_revenue, sustainability_input])

    return {
        "total": total_score,
        "details": {
            "localization": localization,
            "non_oil_contribution": _clamp(non_oil, 0, 100),
            "sustainability": sustainability,
            "job_creation": job_creation,
            "financial_stability": financial_stability,
            "sector_weight": sector_weight,
            "data_quality": _js_round(actual_inputs / 6 * 100),
            "actual_inputs_used": actual_inputs,
        },
        "weights": {
            "localization": "25%",
            "non_oil_contribution": "30%",
            "sustainability": "25%",
            "job_creation": "20%",
        },
        "methodology": "بيانات أثر فعلية عند توفرها، وإلا تقدير معلن من القطاع والاستقرار المالي.",
    }


def compare_with_sector(raw_data: dict, metrics: dict) -> dict:
    sector = raw_data.get("sector", "أخرى")
    benchmark = SECTOR_BENCHMARKS.get(sector, SECTOR_BENCHMARKS["أخرى"])
    return {
        "sector": sector,
        "current_ratio": {
            "company": metrics.get("current_ratio"),
            "sector_avg": benchmark["avg_current_ratio"],
            "comparison": "above" if (metrics.get("current_ratio") or 0) >= benchmark["avg_current_ratio"] else "below",
        },
        "debt_ratio": {
            "company": metrics.get("debt_ratio"),
            "sector_avg": benchmark["avg_debt_ratio"],
            "comparison": "better" if (metrics.get("debt_ratio") or 1) <= benchmark["avg_debt_ratio"] else "worse",
        },
        "profit_margin": {
            "company": metrics.get("net_profit_margin"),
            "sector_avg": benchmark["avg_profit_margin"],
            "comparison": "above" if (metrics.get("net_profit_margin") or 0) >= benchmark["avg_profit_margin"] else "below",
        },
    }


def build_scoring_output(raw_data: dict, metrics: dict) -> dict:
    health = calculate_health_score(raw_data, metrics)
    default_probability = calculate_default_probability(raw_data, metrics, health["health_score"])
    risk_level = "Low" if default_probability <= 10 else "Medium" if default_probability <= 30 else "High"
    financing = calculate_recommended_financing(raw_data, metrics, risk_level, default_probability)
    return {
        "risk_level": risk_level,
        "health_score": health["health_score"],
        "health_components": health["components"],
        "default_probability": default_probability,
        "interest_rate": financing["interest_rate"],
        "recommended_financing": financing["amount"],
        "financing_calculation": financing,
        "vision_2030": calculate_vision_2030_score(raw_data, metrics),
        "sector_comparison": compare_with_sector(raw_data, metrics),
        "note": "مؤشرات دعم قرار شفافة وليست موافقة تمويل نهائية أو PD رقابية معايرة.",
    }
