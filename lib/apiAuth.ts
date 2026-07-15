import { NextRequest } from "next/server";
import {
  BANK_SESSION_COOKIE,
  COMPANY_SESSION_COOKIE,
  REPORT_ACCESS_COOKIE,
  INQUIRY_COLLATERAL_COOKIE,
  verifyCompanySessionToken,
  verifyReportAccessToken,
  verifyInquiryCollateralAccessToken,
  verifySessionToken,
} from "./auth";

export function getBankSession(req: NextRequest) {
  return verifySessionToken(req.cookies.get(BANK_SESSION_COOKIE)?.value);
}

export function getCompanySession(req: NextRequest) {
  return verifyCompanySessionToken(
    req.cookies.get(COMPANY_SESSION_COOKIE)?.value,
  );
}

export function hasAuthenticatedPortalSession(req: NextRequest): boolean {
  return Boolean(getBankSession(req) || getCompanySession(req));
}

export function canReadReport(
  req: NextRequest,
  reportId: string,
  ownerCompanyId?: string,
): boolean {
  if (getBankSession(req)) return true;
  if (
    verifyReportAccessToken(
      req.cookies.get(REPORT_ACCESS_COOKIE)?.value,
      reportId,
    )
  ) {
    return true;
  }
  const company = getCompanySession(req);
  return Boolean(company && ownerCompanyId && company.companyId === ownerCompanyId);
}

export function getInquiryCollateralAccess(
  req: NextRequest,
  requestId: string,
) {
  return verifyInquiryCollateralAccessToken(
    req.cookies.get(INQUIRY_COLLATERAL_COOKIE)?.value,
    requestId,
  );
}
