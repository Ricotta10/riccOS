import { supabase } from "@/lib/supabase";

const VAPID_PUBLIC_KEY = (import.meta.env["VITE_VAPID_PUBLIC_KEY"] as string | undefined) || "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export type PushUnsupportedReason =
  | "no-window"
  | "no-service-worker"
  | "no-push-manager"
  | "no-vapid-key"
  | null;

export function getPushUnsupportedReason(): PushUnsupportedReason {
  if (typeof window === "undefined") return "no-window";
  if (!("serviceWorker" in navigator)) return "no-service-worker";
  if (!("PushManager" in window)) return "no-push-manager";
  if (!VAPID_PUBLIC_KEY) return "no-vapid-key";
  return null;
}

export function isPushSupported(): boolean {
  return getPushUnsupportedReason() === null;
}

export type PushState = "subscribed" | "unsubscribed" | "timeout" | PushUnsupportedReason;

function timeout(ms: number): Promise<"timeout"> {
  return new Promise((resolve) => setTimeout(() => resolve("timeout"), ms));
}

export async function getPushSubscriptionState(): Promise<PushState> {
  const reason = getPushUnsupportedReason();
  if (reason) return reason;

  return Promise.race([
    (async () => {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      return existing ? ("subscribed" as const) : ("unsubscribed" as const);
    })(),
    timeout(8000),
  ]);
}

export async function subscribeToPush(userId: string): Promise<void> {
  if (!isPushSupported()) throw new Error("Notificações push não são suportadas neste dispositivo.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permissão de notificação negada.");
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }

  const json = subscription.toJSON();
  const keys = json.keys ?? {};
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: keys["p256dh"],
      auth: keys["auth"],
    },
    { onConflict: "endpoint" },
  );

  if (error) throw error;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
