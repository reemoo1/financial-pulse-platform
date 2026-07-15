import { publicFileSummary } from "./fileUpload";
import { StoredFinancingRequest } from "./types";

/** Removes OTP material before a financing request crosses an API/RSC boundary. */
export function withoutTicketSecurity(
  request: StoredFinancingRequest,
): StoredFinancingRequest {
  const { security: _security, ...data } = request.data;
  return { ...request, data };
}

/** A least-privilege view for the generic authenticated request endpoint. */
export function financingRequestPortalView(request: StoredFinancingRequest) {
  const safe = withoutTicketSecurity(request);
  return {
    ...safe,
    data: {
      ...safe.data,
      uploadedFiles: (safe.data.uploadedFiles || []).map(publicFileSummary),
    },
  };
}
