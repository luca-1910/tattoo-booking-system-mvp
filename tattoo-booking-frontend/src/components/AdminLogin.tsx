"use client";
import { supabaseBrowser } from "@/lib/supabaseBrowserClient";
import { useState } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";

interface AdminLoginProps {
  onNavigate: (page: string) => void;
  onLogin: () => void;
}

export function AdminLogin({ onNavigate, onLogin }: AdminLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false); // ✅ defines setLoading
  const supabase = supabaseBrowser(); // ✅ defines supabase

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return toast.error(error.message || "Sign in failed");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return toast.error("No active session. Please try again.");

      // ✅ Single-admin validation (choose ONE of the checks)
      const allowedEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      const allowedUid = process.env.NEXT_PUBLIC_ADMIN_UID;

      const emailOk = allowedEmail ? user.email === allowedEmail : true;
      const uidOk = allowedUid ? user.id === allowedUid : true;

      if (!(emailOk && uidOk)) {
        await supabase.auth.signOut();
        return toast.error("Unauthorized account.");
      }

      toast.success("Login successful!");
      onLogin?.();
      onNavigate("dashboard");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err?.message ?? "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Button
          variant="ghost"
          onClick={() => onNavigate("home")}
          className="mb-8 text-[#e5e5e5] hover:text-[#a32020]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <div className="bg-[#1a1a1a] rounded-lg p-8 border border-[rgba(255,255,255,0.1)]">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-[#a32020]/10 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-[#a32020]" />
            </div>
          </div>

          <h2 className="text-center mb-2">Admin Login</h2>
          <p className="text-center text-[#a0a0a0] mb-8">
            Access your artist dashboard
          </p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@missmay.com"
                className="mt-2 bg-[#0a0a0a] border-[rgba(255,255,255,0.1)] text-[#e5e5e5]"
                required
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-2 bg-[#0a0a0a] border-[rgba(255,255,255,0.1)] text-[#e5e5e5]"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#a32020] hover:bg-[#8a1b1b] text-white"
            >
             {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          <p className="mt-6 text-center text-[#a0a0a0]">
            Forgot your password? Contact support
          </p>
        </div>
      </div>
    </div>
  );
}
