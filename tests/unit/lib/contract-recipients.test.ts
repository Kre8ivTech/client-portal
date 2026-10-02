import { describe, expect, it, vi } from "vitest";
import {
  CONTRACT_RECIPIENT_SELECT,
  canLoadContractRecipients,
  loadContractRecipients,
  mapContractRecipientRows,
} from "@/lib/contracts/recipients";

const parentOrg = "11111111-1111-1111-1111-111111111111";
const childOrg = "22222222-2222-2222-2222-222222222222";

describe("contract recipient query", () => {
  it("does not select the missing users.full_name column", () => {
    expect(CONTRACT_RECIPIENT_SELECT).not.toContain("full_name");
    expect(CONTRACT_RECIPIENT_SELECT).toContain("profiles(name)");
  });

  it("names recipients from profiles and keeps child-org clients", () => {
    const mapped = mapContractRecipientRows(
      [
        {
          id: "admin-user",
          email: "admin@parent.test",
          role: "super_admin",
          status: "active",
          organization_id: parentOrg,
          profiles: { name: "Admin" },
          organizations: { name: "Parent Co" },
        },
        {
          id: "child-client",
          email: "ada@child.test",
          role: "client",
          status: "active",
          organization_id: childOrg,
          profiles: { name: "Ada Client" },
          organizations: { name: "Child Co" },
        },
        {
          id: "inactive-client",
          email: "old@child.test",
          role: "client",
          status: "inactive",
          organization_id: childOrg,
          profiles: { name: "Old Client" },
          organizations: { name: "Child Co" },
        },
      ],
      "admin-user",
    );

    expect(mapped).toEqual([
      {
        id: "child-client",
        email: "ada@child.test",
        organizationId: childOrg,
        organizationName: "Child Co",
        name: "Ada Client (Child Co)",
      },
    ]);
  });

  it("loads child-org recipients for staff with the safe select", async () => {
    const selects: string[] = [];
    const usersQuery = {
      in: vi.fn(),
      order: vi.fn(),
    };
    usersQuery.in.mockReturnValue(usersQuery);
    usersQuery.order.mockImplementation(() =>
      Promise.resolve({
        data: [
          {
            id: "child-client",
            email: "ada@child.test",
            role: "client",
            status: "active",
            organization_id: childOrg,
            profiles: [{ name: "Ada Client" }],
            organizations: { name: "Child Co" },
          },
        ],
        error: null,
      }),
    );

    const orgsQuery = {
      eq: vi.fn(),
      in: vi.fn(),
    };
    orgsQuery.eq.mockReturnValue(orgsQuery);
    orgsQuery.in.mockImplementation(() =>
      Promise.resolve({ data: [{ id: childOrg }], error: null }),
    );

    const supabase = {
      from: (table: string) => {
        if (table === "organizations") return { select: () => orgsQuery };
        if (table === "users") {
          return {
            select: (columns: string) => {
              selects.push(columns);
              return usersQuery;
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    };

    const recipients = await loadContractRecipients(
      supabase,
      { role: "staff", organization_id: parentOrg },
      "staff-user",
    );

    expect(selects).toEqual([CONTRACT_RECIPIENT_SELECT]);
    expect(usersQuery.in).toHaveBeenCalledWith("organization_id", [parentOrg, childOrg]);
    expect(recipients[0]?.name).toBe("Ada Client (Child Co)");
  });

  it("does not load recipients for clients or partners", async () => {
    const supabase = { from: vi.fn() };
    expect(canLoadContractRecipients("client")).toBe(false);
    expect(canLoadContractRecipients("partner")).toBe(false);
    expect(canLoadContractRecipients("admin")).toBe(true);

    await expect(
      loadContractRecipients(supabase, { role: "partner", organization_id: parentOrg }, "partner-user"),
    ).resolves.toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
