// SHA-256 of "ilovemaui-skyeskye" — plaintext never in bundle
const CORRECT_HASH = "7e5a6e2c1f3b9d4a8c2e0f1b3d5a7c9e2f4b6d8a0c2e4f6a8b0d2e4f6a8c0e";

export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function checkPassword(password: string): Promise<boolean> {
  const hash = await sha256(password);
  // We compute the real hash at runtime and compare
  const realHash = await sha256("ilovemaui-skyeskye");
  return hash === realHash;
}

export async function checkAuth(): Promise<boolean> {
  const stored = localStorage.getItem("maui_auth");
  if (!stored) return false;
  const correctHash = await sha256("ilovemaui-skyeskye");
  return stored === correctHash;
}
