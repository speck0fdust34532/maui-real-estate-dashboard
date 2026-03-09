export const CORRECT_PASSWORD = "ilovemaui-skyeskye";

export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function checkAuth(): Promise<boolean> {
  const stored = localStorage.getItem("maui_auth");
  if (!stored) return false;
  const correctHash = await sha256(CORRECT_PASSWORD);
  return stored === correctHash;
}
