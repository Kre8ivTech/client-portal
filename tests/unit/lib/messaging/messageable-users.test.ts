import { describe, expect, it } from "vitest";
import {
  filterMessageableUsers,
  messageableOrganizationIds,
  type MessageableCandidate,
} from "@/lib/messaging/messageable-users";

const partnerOrg = "11111111-1111-1111-1111-111111111111";
const platformOrg = "22222222-2222-2222-2222-222222222222";
const childOrg = "33333333-3333-3333-3333-333333333333";
const otherOrg = "44444444-4444-4444-4444-444444444444";

const partnerId = "partner-user";

function user(partial: MessageableCandidate): MessageableCandidate {
  return partial;
}

const directory: MessageableCandidate[] = [
  user({
    id: partnerId,
    email: "jeremiah@embark-marketing.test",
    role: "partner",
    organization_id: partnerOrg,
    status: "active",
    profiles: { name: "Jeremiah Castillo" },
    organization: { name: "Embark Marketing" },
  }),
  user({
    id: "partner-staff",
    email: "pat@embark-marketing.test",
    role: "partner_staff",
    organization_id: partnerOrg,
    status: "active",
    profiles: { name: "Pat Staff" },
    organization: { name: "Embark Marketing" },
  }),
  user({
    id: "child-client",
    email: "ada@client.test",
    role: "client",
    organization_id: childOrg,
    status: "active",
    profiles: { name: "Ada Client" },
    organization: { name: "Child Co" },
  }),
  user({
    id: "platform-jeremiah",
    email: "jcastillo@kre8ivtech.test",
    role: "super_admin",
    organization_id: platformOrg,
    status: "active",
    profiles: { name: "Jeremiah Castillo" },
    organization: { name: "Kre8ivTech, LLC" },
  }),
  user({
    id: "platform-staff",
    email: "sam@kre8ivtech.test",
    role: "staff",
    organization_id: platformOrg,
    status: "active",
    profiles: { name: "Sam Staff" },
    organization: { name: "Kre8ivTech, LLC" },
  }),
  user({
    id: "platform-client",
    email: "not-staff@kre8ivtech.test",
    role: "client",
    organization_id: platformOrg,
    status: "active",
    profiles: { name: "Platform Client" },
  }),
  user({
    id: "other-org",
    email: "other@elsewhere.test",
    role: "client",
    organization_id: otherOrg,
    status: "active",
    profiles: { name: "Other Jeremiah" },
  }),
  user({
    id: "inactive",
    email: "old@embark-marketing.test",
    role: "partner_staff",
    organization_id: partnerOrg,
    status: "inactive",
    profiles: { name: "Inactive Jeremiah" },
  }),
];

const partnerScope = {
  currentUserId: partnerId,
  role: "partner",
  organizationId: partnerOrg,
  parentOrgId: platformOrg,
  childOrgIds: [childOrg],
};

describe("messageableOrganizationIds", () => {
  it("keeps clients in their own organization", () => {
    expect(
      messageableOrganizationIds({
        role: "client",
        organizationId: childOrg,
        parentOrgId: partnerOrg,
        childOrgIds: [otherOrg],
      }),
    ).toEqual([childOrg]);
  });

  it("includes the partner org, child orgs, and the parent platform org", () => {
    expect(
      messageableOrganizationIds({
        role: "partner_staff",
        organizationId: partnerOrg,
        parentOrgId: platformOrg,
        childOrgIds: [childOrg],
      }),
    ).toEqual([partnerOrg, platformOrg, childOrg]);
  });

  it("lets platform staff search across organizations", () => {
    expect(
      messageableOrganizationIds({
        role: "staff",
        organizationId: platformOrg,
        parentOrgId: null,
        childOrgIds: [],
      }),
    ).toBe("all");
  });
});

describe("filterMessageableUsers", () => {
  it("matches a partner name search against name or email, including self and parent staff", () => {
    const results = filterMessageableUsers(partnerScope, directory, "jerem");
    expect(results.map((row) => row.id)).toEqual([partnerId, "platform-jeremiah"]);
    expect(results[0]?.profiles?.name).toBe("Jeremiah Castillo");
    expect(results[1]?.email).toBe("jcastillo@kre8ivtech.test");
  });

  it("lists own-org users, child-org users, and parent platform staff when the search is empty", () => {
    const results = filterMessageableUsers(partnerScope, directory, "");
    expect(results.map((row) => row.id)).toEqual([
      "child-client",
      partnerId,
      "platform-jeremiah",
      "partner-staff",
      "platform-staff",
    ]);
  });

  it("does not list parent-org clients, inactive users, or unrelated organizations", () => {
    const results = filterMessageableUsers(partnerScope, directory, "");
    const ids = results.map((row) => row.id);
    expect(ids).not.toContain("platform-client");
    expect(ids).not.toContain("other-org");
    expect(ids).not.toContain("inactive");
  });

  it("applies the same directory to partner staff", () => {
    const results = filterMessageableUsers(
      { ...partnerScope, role: "partner_staff", currentUserId: "partner-staff" },
      directory,
      "sam",
    );
    expect(results.map((row) => row.id)).toEqual(["platform-staff"]);
  });

  it("keeps a client inside their own organization", () => {
    const results = filterMessageableUsers(
      {
        currentUserId: "child-client",
        role: "client",
        organizationId: childOrg,
        parentOrgId: partnerOrg,
        childOrgIds: [],
      },
      directory,
      "",
    );
    expect(results.map((row) => row.id)).toEqual(["child-client"]);
  });

  it("lets platform staff find users outside their organization", () => {
    const results = filterMessageableUsers(
      {
        currentUserId: "platform-staff",
        role: "staff",
        organizationId: platformOrg,
        parentOrgId: null,
        childOrgIds: [],
      },
      directory,
      "ada",
    );
    expect(results.map((row) => row.id)).toEqual(["child-client"]);
  });
});
