import { describe, expect, it } from "vitest";
import {
  createInquiryCollateralAccessToken,
  verifyInquiryCollateralAccessToken,
} from "../lib/auth";

describe("OTP inquiry collateral access", () => {
  it("grants access only to the financing request verified by OTP", () => {
    const token = createInquiryCollateralAccessToken("request-123", "شركة الاختبار");

    expect(
      verifyInquiryCollateralAccessToken(token, "request-123"),
    ).toMatchObject({
      requestId: "request-123",
      applicantName: "شركة الاختبار",
    });
    expect(
      verifyInquiryCollateralAccessToken(token, "request-456"),
    ).toBeNull();
  });

  it("rejects a tampered token", () => {
    const token = createInquiryCollateralAccessToken("request-123", "شركة الاختبار");
    const [body, signature] = token.split(".");
    const tamperedSignature = `${signature.slice(0, -1)}${signature.endsWith("0") ? "1" : "0"}`;

    expect(
      verifyInquiryCollateralAccessToken(
        `${body}.${tamperedSignature}`,
        "request-123",
      ),
    ).toBeNull();
  });
});
