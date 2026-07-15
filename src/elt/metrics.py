from __future__ import annotations
from decimal import Decimal, ROUND_FLOOR
from typing import Any
import pandas as pd


def safe_divide(a, b):
    if a is None or b is None or pd.isna(a) or pd.isna(b) or b == 0:
        return None
    return a / b


def to_number(value: Any, digits: int = 4):
    if value is None or pd.isna(value):
        return None
    try:
        numeric = Decimal(str(value))
        factor = Decimal(10) ** digits
        rounded = (numeric * factor + Decimal("0.5")).to_integral_value(
            rounding=ROUND_FLOOR
        )
        return float(rounded / factor)
    except Exception:
        return None


def _value(row: pd.Series, key: str):
    if key not in row.index or pd.isna(row[key]):
        return None
    return float(row[key])


def _sum_if_complete(values):
    return None if any(v is None for v in values) else sum(values)


def calculate_financial_metrics(df: pd.DataFrame) -> dict:
    if df.empty:
        return {}

    row = df.iloc[0]
    g = lambda key: _value(row, key)
    metrics: dict[str, Any] = {}

    total_assets = g("total_assets")
    current_assets = g("current_assets")
    cash = g("cash")
    inventory = g("inventory")
    receivables = g("accounts_receivable")
    liabilities = g("total_liabilities")
    current_liabilities = g("current_liabilities")
    equity = g("equity")
    revenue = g("revenue")
    cogs = g("cost_of_goods_sold")
    gross_profit = g("gross_profit")
    operating_income = g("operating_income")
    net_income = g("net_income")
    interest_expense = g("interest_expense")
    operating_cf = g("operating_cash_flow")
    investing_cf = g("investing_cash_flow")

    metrics["current_ratio"] = to_number(safe_divide(current_assets, current_liabilities))
    metrics["quick_ratio"] = to_number(
        safe_divide(None if current_assets is None or inventory is None else current_assets - inventory, current_liabilities)
    )
    metrics["cash_ratio"] = to_number(safe_divide(cash, current_liabilities))
    metrics["working_capital"] = to_number(
        None if current_assets is None or current_liabilities is None else current_assets - current_liabilities,
        2,
    )

    metrics["debt_to_equity"] = to_number(safe_divide(liabilities, equity))
    metrics["debt_ratio"] = to_number(safe_divide(liabilities, total_assets))
    metrics["equity_ratio"] = to_number(safe_divide(equity, total_assets))

    metrics["gross_profit_margin"] = to_number(safe_divide(gross_profit, revenue))
    metrics["operating_margin"] = to_number(safe_divide(operating_income, revenue))
    metrics["net_profit_margin"] = to_number(safe_divide(net_income, revenue))
    metrics["roa"] = to_number(safe_divide(net_income, total_assets))
    metrics["roe"] = to_number(safe_divide(net_income, equity))
    metrics["ebit"] = to_number(operating_income, 2)
    metrics["ebit_margin"] = to_number(safe_divide(operating_income, revenue))

    depreciation = g("depreciation")
    amortization = g("amortization")
    if operating_income is not None and (depreciation is not None or amortization is not None):
        ebitda = operating_income + (depreciation or 0) + (amortization or 0)
        metrics["ebitda"] = to_number(ebitda, 2)
        metrics["ebitda_margin"] = to_number(safe_divide(ebitda, revenue))
    else:
        metrics["ebitda"] = None
        metrics["ebitda_margin"] = None

    metrics["interest_coverage"] = to_number(safe_divide(operating_income, interest_expense))

    explicit_cfads = g("cfads")
    maintenance_capex = g("maintenance_capex")
    derived_cfads = (
        operating_cf - maintenance_capex
        if operating_cf is not None and maintenance_capex is not None
        else None
    )
    cfads = explicit_cfads if explicit_cfads is not None else derived_cfads
    debt_service_values = [
        g("scheduled_principal"),
        g("scheduled_interest"),
        g("mandatory_debt_fees"),
        g("finance_lease_payments"),
    ]
    contractual_debt_service = _sum_if_complete(debt_service_values)
    metrics["cfads"] = to_number(cfads, 2)
    metrics["contractual_debt_service"] = to_number(contractual_debt_service, 2)
    metrics["dscr"] = to_number(safe_divide(cfads, contractual_debt_service))
    if cfads is None or contractual_debt_service is None or contractual_debt_service <= 0:
        metrics["dscr_method"] = "unavailable"
    elif explicit_cfads is not None:
        metrics["dscr_method"] = "cfads_contractual"
    else:
        metrics["dscr_method"] = "ocf_less_maintenance_capex"

    banking_checks = [
        g("retained_earnings") is not None,
        cfads is not None,
        *[value is not None for value in debt_service_values],
    ]
    metrics["banking_data_quality"] = to_number(
        (sum(1 for value in banking_checks if value) / len(banking_checks)) * 100,
        0,
    )

    metrics["operating_cash_flow_ratio"] = to_number(safe_divide(operating_cf, current_liabilities))
    metrics["operating_cash_flow_to_debt"] = to_number(safe_divide(operating_cf, liabilities))
    metrics["free_cash_flow"] = to_number(
        None if operating_cf is None or investing_cf is None else operating_cf + investing_cf,
        2,
    )

    metrics["asset_turnover"] = to_number(safe_divide(revenue, total_assets))
    metrics["inventory_turnover"] = to_number(safe_divide(cogs, inventory))
    metrics["receivables_turnover"] = to_number(safe_divide(revenue, receivables))

    retained_earnings = g("retained_earnings")
    if all(v is not None for v in [current_assets, current_liabilities, total_assets, operating_income, equity, liabilities, revenue, retained_earnings]) and total_assets != 0 and liabilities != 0:
        wc = current_assets - current_liabilities
        altman_z = (
            0.717 * (wc / total_assets)
            + 0.847 * (retained_earnings / total_assets)
            + 3.107 * (operating_income / total_assets)
            + 0.42 * (equity / liabilities)
            + 0.998 * (revenue / total_assets)
        )
        metrics["altman_z_score"] = to_number(altman_z)
        metrics["altman_model"] = "private_full"
    else:
        metrics["altman_z_score"] = None
        metrics["altman_model"] = "unavailable"

    return metrics
