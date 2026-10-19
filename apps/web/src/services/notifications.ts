import { apiFetch } from "@/lib/nitro-client";

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  titre: string;
  message: string | null;
  lien: string | null;
  lu: boolean;
  created_at: string;
};

export type CreateNotificationInput = {
  user_id: string;
  type: string;
  titre: string;
  message?: string | null;
  lien?: string | null;
};

export async function fetchMyNotifications(query?: {
  lu?: "true" | "false" | "all";
  limit?: number;
}): Promise<NotificationRow[]> {
  const params = new URLSearchParams();
  if (query?.lu) params.set("lu", query.lu);
  if (query?.limit) params.set("limit", String(query.limit));

  const qs = params.toString();
  return apiFetch<NotificationRow[]>(`/api/notifications${qs ? `?${qs}` : ""}`);
}

export async function markNotificationsRead(
  id?: string
): Promise<{ success: boolean; count?: number } | NotificationRow> {
  return apiFetch("/api/notifications/mark-read", {
    method: "PUT",
    body: JSON.stringify(id ? { id } : {}),
  });
}

export async function deleteNotification(id: string): Promise<NotificationRow> {
  return apiFetch<NotificationRow>(`/api/notifications/${id}`, {
    method: "DELETE",
  });
}

export async function createNotification(
  data: CreateNotificationInput
): Promise<NotificationRow> {
  return apiFetch<NotificationRow>("/api/notifications", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
