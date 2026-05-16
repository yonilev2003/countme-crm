"use server";

// Server action consumed by <NotificationBell />. Kept as its own file so
// the bell component stays a client module — Next refuses to bundle a "use
// server" function defined inside a "use client" module.

import { createClient } from "@/lib/supabase/server";
import {
  loadNotificationsForUser,
  type NotificationItem,
} from "@/lib/notifications";

export async function getMyNotifications(): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  try {
    return await loadNotificationsForUser(supabase, user.id);
  } catch {
    return [];
  }
}
