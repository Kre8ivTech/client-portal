import { describe, expect, it } from "vitest";
import {
  DOCUSIGN_NOT_CONFIGURED_MESSAGE,
  DOCUSIGN_REQUIRED_ENV,
  contractDocumentFromHtml,
  decideContractSubmit,
  missingDocuSignEnv,
} from "@/lib/contracts/docusign-config";

const configuredEnv = Object.fromEntries(
  DOCUSIGN_REQUIRED_ENV.map((name) => [name, `${name}-value`]),
);

describe("decideContractSubmit", () => {
  it("sends only when every DocuSign credential is set", () => {
    expect(decideContractSubmit(configuredEnv)).toEqual({ outcome: "send" });
  });

  it("blocks the send when credentials are missing and does not report success", () => {
    const decision = decideContractSubmit({});
    expect(decision).toEqual({
      outcome: "not_configured",
      message: DOCUSIGN_NOT_CONFIGURED_MESSAGE,
    });
    expect(missingDocuSignEnv({})).toEqual([...DOCUSIGN_REQUIRED_ENV]);
  });

  it("treats blank credentials as missing", () => {
    expect(
      decideContractSubmit({
        ...configuredEnv,
        DOCUSIGN_PRIVATE_KEY: "   ",
      }).outcome,
    ).toBe("not_configured");
  });

  it("builds an HTML envelope document with a signature anchor", () => {
    const document = contractDocumentFromHtml("Agreement", "<p>Hello</p>");
    const html = Buffer.from(document.documentBase64, "base64").toString("utf8");
    expect(document.fileExtension).toBe("html");
    expect(html).toContain("<p>Hello</p>");
    expect(html).toContain("/sn1/");
  });
});
