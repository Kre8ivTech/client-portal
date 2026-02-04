import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface MessageableUser {
  id: string;
  email: string;
  role: string;
  organization_id: string;
  profiles: {
    name: string | null;
    avatar_url: string | null;
    presence_status: string | null;
  } | null;
  organization: {
    name: string;
  } | null;
}

export function useMessageableUsers(searchQuery: string = "") {
  const supabase = createClient();

  return useQuery({
    queryKey: ["messageable-users", searchQuery],
    queryFn: async () => {
      // Get current user's info first
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

      // Build query for messageable users
      let query = supabase
        .from("users")
        .select(
          `
          id,
          email,
          role,
          organization_id,
          profiles:profiles(name, avatar_url, presence_status),
          organization:organizations!users_organization_id_fkey(name)
        `,
        )
        .neq("id", user.id)
        .eq("status", "active");

      // Apply search filter if provided - email only (profiles.name filtering done client-side)
      if (searchQuery.trim()) {
        query = query.ilike("email", `%${searchQuery}%`);
      }

      // For staff/super_admin, they can see all users
      // For others, filter based on organization relationships
      const isStaff = ["super_admin", "staff"].includes(currentUserData.role);

      if (!isStaff) {
        // Get partner/client relationships
        const { data: relatedOrgs } = await supabase
          .from("organizations")
          .select("id, parent_org_id")
          .or(`id.eq.${currentUserData.organization_id},parent_org_id.eq.${currentUserData.organization_id}`);

        const orgIds = relatedOrgs?.map((o) => o.id) || [currentUserData.organization_id];

        // Also include parent org if current org has one
        const { data: currentOrg } = await supabase
          .from("organizations")
          .select("parent_org_id")
          .eq("id", currentUserData.organization_id)
          .single();

        if (currentOrg?.parent_org_id) {
          orgIds.push(currentOrg.parent_org_id);
        }

        query = query.in("organization_id", orgIds);
      }

      // Order by email (profiles.name ordering done client-side)
      query = query.order("email", { ascending: true });
      query = query.limit(50);

      const { data, error } = await query;

      if (error) throw error;

      // Filter by name if search query provided (client-side)
      let results = data as MessageableUser[];
      if (searchQuery.trim()) {
        const searchLower = searchQuery.toLowerCase();
        results = results.filter(
          (u) => u.email.toLowerCase().includes(searchLower) || u.profiles?.name?.toLowerCase().includes(searchLower),
        );
      }

      // Sort by name if available, otherwise email (client-side)
      results.sort((a, b) => {
        const aName = a.profiles?.name || a.email;
        const bName = b.profiles?.name || b.email;
        return aName.localeCompare(bName);
      });

      return results;
    },
    enabled: true,
    staleTime: 30000, // Cache for 30 seconds
  });
}

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
