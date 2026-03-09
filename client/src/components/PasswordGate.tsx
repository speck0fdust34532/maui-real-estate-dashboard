import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Loader2, Lock, Waves } from "lucide-react";
import { sha256, CORRECT_PASSWORD } from "@/lib/auth";

export default function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError("");
    const hash = await sha256(password);
    const correctHash = await sha256(CORRECT_PASSWORD);
    if (hash === correctHash) {
      localStorage.setItem("maui_auth", hash);
      onAuth();
    } else {
      setError("Incorrect password");
    }
    setChecking(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0077B6] via-[#0096C7] to-[#F4E4C1] p-4">
      <Card className="w-full max-w-md p-8 shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#0077B6]/10 mb-4">
            <Waves className="w-8 h-8 text-[#0077B6]" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Maui Property Search</h1>
          <p className="text-muted-foreground mt-2">Enter password to access the dashboard</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12 text-base"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-[#FF6B6B] font-medium">{error}</p>}
          <Button type="submit" className="w-full h-12 text-base bg-[#0077B6] hover:bg-[#005F8A] text-white" disabled={checking}>
            {checking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Access Dashboard
          </Button>
        </form>
      </Card>
    </div>
  );
}
