import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  filterMessageableUsers,
  isPartnerDirectoryRole,
  messageableOrganizationIds,
  type MessageableCandidate,
} from "@/lib/messaging/messageable-users";

export type { MessageableUser } from "@/lib/messaging/messageable-users";

export function useMessageableUsers(searchQuery: string = "") {
  const supabase = createClient();

  return useQuery({
    queryKey: ["messageable-users", searchQuery],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: currentUserData, error: currentUserError } = await supabase
        .from("users")
        .select("organization_id, role")
        .eq("id", user.id)
        .single();

      if (currentUserError) throw currentUserError;

      const role = currentUserData.role as string;
      const organizationId = (currentUserData.organization_id as string | null) ?? null;
      let parentOrgId: string | null = null;
      let childOrgIds: string[] = [];

      if (isPartnerDirectoryRole(role) && organizationId) {
        const { data: currentOrg, error: orgError } = await supabase
          .from("organizations")
          .select("parent_org_id")
          .eq("id", organizationId)
          .single();

        if (orgError) throw orgError;
        parentOrgId = (currentOrg?.parent_org_id as string | null) ?? null;

        const { data: children, error: childError } = await supabase
          .from("organizations")
          .select("id")
          .eq("parent_org_id", organizationId);

        if (childError) throw childError;
        childOrgIds = (children ?? []).map((org: { id: string }) => org.id);
      }

      const scope = messageableOrganizationIds({
        role,
        organizationId,
        parentOrgId,
        childOrgIds,
      });

      let query = supabase
        .from("users")
        .select(
          `
          id,
          email,
          role,
          status,
          organization_id,
          profiles:profiles(name, avatar_url, presence_status),
          organization:organizations!users_organization_id_fkey(name)
        `,
        )
        .eq("status", "active");

      if (scope !== "all") {
        if (scope.length === 0) return [];
        query = query.in("organization_id", scope);
      }

      const { data, error } = await query.order("email", { ascending: true }).limit(200);

      if (error) throw error;

      return filterMessageableUsers(
        {
          currentUserId: user.id,
          role,
          organizationId,
          parentOrgId,
          childOrgIds,
        },
        (data ?? []) as MessageableCandidate[],
        searchQuery,
      );
    },
    enabled: true,
    staleTime: 30000, // Cache for 30 seconds
  });
}

// @deprecated - currently unused
export function useExistingConversation(userId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["existing-conversation", userId],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      // Check if a direct conversation already exists between the two users
      const { data, error } = await supabase
        .from("conversation_participants")
        .select(
          `
          conversation_id,
          conversations!inner(id, type)
        `,
        )
        .eq("user_id", user.id)
        .eq("conversations.type", "direct");

      if (error) throw error;

      // Check which of these conversations include the target user
      for (const cp of data || []) {
        const { data: otherParticipant } = await supabase
          .from("conversation_participants")
          .select("user_id")
          .eq("conversation_id", cp.conversation_id)
          .eq("user_id", userId)
          .single();

        if (otherParticipant) {
          return cp.conversation_id;
        }
      }

      return null;
    },
    enabled: !!userId,
  });
}
