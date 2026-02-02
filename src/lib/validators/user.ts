import { z } from "zod";

/**
 * User validation schemas for KT-Portal
 */

// Available user roles in the system
export const userRoleSchema = z.enum([
  "super_admin",
  "staff",
  "partner",
  "partner_staff",
  "client",
]);

export type UserRole = z.infer<typeof userRoleSchema>;

/**
 * Schema for creating a new user
 */
export const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
  role: userRoleSchema,
  organization_id: z.string().uuid("Invalid organization ID").nullable(),
  is_account_manager: z.boolean().default(false),
  send_invite_email: z.boolean().default(true),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * Schema for updating an existing user
 */
export const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long").optional(),
  role: userRoleSchema.optional(),
  organization_id: z.string().uuid("Invalid organization ID").nullable().optional(),
  is_account_manager: z.boolean().optional(),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * Determines which roles a user can create based on their own role
 */
export function getAllowedRolesToCreate(
  currentUserRole: UserRole,
  isAccountManager: boolean
): UserRole[] {
  switch (currentUserRole) {
    case "super_admin":
      // Admin can create any role
      return ["super_admin", "staff", "partner", "partner_staff", "client"];
    case "staff":
      // Staff (including account managers and project managers) can only create clients
      return ["client"];
    default:
      // Partners and clients cannot create users
      return [];
  }
}

/**
 * Checks if a user can create new users
 */
export function canCreateUsers(
  currentUserRole: UserRole,
  isAccountManager: boolean
): boolean {
  // Admin can always create users
  if (currentUserRole === "super_admin") {
    return true;
  }
  
  // Staff (which includes account managers and project managers) can create clients
  if (currentUserRole === "staff") {
    return true;
  }
  
  return false;
}
