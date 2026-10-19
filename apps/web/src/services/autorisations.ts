import { apiFetch } from "@/lib/nitro-client";

export type RoleItem = {
  id: string;
  code: string;
  nom: string;
  description: string | null;
  is_system: boolean;
  permissionsCount: number;
  permissions: Array<{
    code: string;
    module: string;
    action: string;
    description: string | null;
    granted: boolean;
  }>;
  usersCount: number;
  created_at: string;
  updated_at: string;
};

export type GroupItem = {
  id: string;
  nom: string;
  description: string | null;
  membersCount: number;
  roles: Array<{ id: string; code: string; nom: string }>;
  permissionsCount: number;
  permissions: Array<{ code: string; granted: boolean; module: string }>;
  created_at: string;
  updated_at: string;
};

export type PermissionItem = {
  id: string;
  code: string;
  module: string;
  action: string;
  description: string | null;
  created_at: string;
};

export type UserAuthItem = {
  id: string;
  nom: string;
  prenom: string | null;
  email: string | null;
  roles: string[];
  roleAssignments: Array<{ id: string; code: string; nom: string }>;
  groups: Array<{ id: string; nom: string }>;
};

export type EffectivePermissions = {
  userId: string;
  isSuperAdmin: boolean;
  grantedPermissions: string[];
  deniedPermissions: string[];
  roles: Array<{ id: string; code: string; nom: string }>;
  groups: Array<{ id: string; nom: string }>;
  provenance: Record<string, { grantedBy: string[]; deniedBy: string[] }>;
};

export type AuthorizationAuditLog = {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string | null;
  row_id: string | null;
  payload: any;
  created_at: string;
  user: {
    id: string;
    nom: string;
    prenom: string | null;
    email: string | null;
  } | null;
};

export async function fetchRoles(): Promise<RoleItem[]> {
  return apiFetch<RoleItem[]>("/api/admin/autorisations/roles");
}

export async function createRole(data: {
  code: string;
  nom: string;
  description?: string | null;
}): Promise<RoleItem> {
  return apiFetch<RoleItem>("/api/admin/autorisations/roles", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getRole(id: string): Promise<RoleItem> {
  return apiFetch<RoleItem>(`/api/admin/autorisations/roles/${id}`);
}

export async function updateRole(
  id: string,
  data: { nom?: string; description?: string | null }
): Promise<RoleItem> {
  return apiFetch<RoleItem>(`/api/admin/autorisations/roles/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteRole(id: string): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>(`/api/admin/autorisations/roles/${id}`, {
    method: "DELETE",
  });
}

export async function setRolePermissions(
  roleId: string,
  permissions: Array<{ permission_code: string; granted: boolean }>
): Promise<RoleItem> {
  return apiFetch<RoleItem>(`/api/admin/autorisations/roles/${roleId}/permissions`, {
    method: "PUT",
    body: JSON.stringify({ permissions }),
  });
}

export async function fetchGroups(): Promise<GroupItem[]> {
  return apiFetch<GroupItem[]>("/api/admin/autorisations/groupes");
}

export async function createGroup(data: {
  nom: string;
  description?: string | null;
}): Promise<GroupItem> {
  return apiFetch<GroupItem>("/api/admin/autorisations/groupes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getGroup(id: string): Promise<any> {
  return apiFetch<any>(`/api/admin/autorisations/groupes/${id}`);
}

export async function updateGroup(
  id: string,
  data: { nom?: string; description?: string | null }
): Promise<GroupItem> {
  return apiFetch<GroupItem>(`/api/admin/autorisations/groupes/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteGroup(id: string): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>(`/api/admin/autorisations/groupes/${id}`, {
    method: "DELETE",
  });
}

export async function setGroupPermissions(
  groupId: string,
  permissions: Array<{ permission_code: string; granted: boolean }>
): Promise<any> {
  return apiFetch<any>(`/api/admin/autorisations/groupes/${groupId}/permissions`, {
    method: "PUT",
    body: JSON.stringify({ permissions }),
  });
}

export async function setGroupRoles(groupId: string, roleIds: string[]): Promise<any> {
  return apiFetch<any>(`/api/admin/autorisations/groupes/${groupId}/roles`, {
    method: "PUT",
    body: JSON.stringify({ role_ids: roleIds }),
  });
}

export async function addGroupMembers(groupId: string, userIds: string[]): Promise<any> {
  return apiFetch<any>(`/api/admin/autorisations/groupes/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({ user_ids: userIds }),
  });
}

export async function removeGroupMember(
  groupId: string,
  userId: string
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(
    `/api/admin/autorisations/groupes/${groupId}/members/${userId}`,
    {
      method: "DELETE",
    }
  );
}

export async function fetchPermissions(): Promise<PermissionItem[]> {
  return apiFetch<PermissionItem[]>("/api/admin/autorisations/permissions");
}

export async function fetchUsersWithAuth(search?: string): Promise<UserAuthItem[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiFetch<UserAuthItem[]>(`/api/admin/autorisations/users${query}`);
}

export async function assignRoleToUser(
  userId: string,
  roleId: string
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/admin/autorisations/users/${userId}/roles`, {
    method: "POST",
    body: JSON.stringify({ role_id: roleId }),
  });
}

export async function revokeRoleFromUser(
  userId: string,
  roleId: string
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(
    `/api/admin/autorisations/users/${userId}/roles/${roleId}`,
    {
      method: "DELETE",
    }
  );
}

export async function fetchEffectivePermissions(userId: string): Promise<EffectivePermissions> {
  return apiFetch<EffectivePermissions>(
    `/api/admin/autorisations/users/${userId}/effective-permissions`
  );
}

export async function fetchAuditLogs(limit = 100): Promise<AuthorizationAuditLog[]> {
  return apiFetch<AuthorizationAuditLog[]>(`/api/admin/autorisations/audit?limit=${limit}`);
}
