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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function AdminLogin({ onNavigate, onLogin }: AdminLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const supabase = supabaseBrowser();

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

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: [
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/calendar.readonly",
          ].join(" "),
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });
      if (error) toast.error(error.message || "Google sign-in failed");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err?.message ?? "Unexpected error");
      setGoogleLoading(false);
    }
    // Note: don't reset googleLoading — the page will redirect
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

          {/* Google Sign-In */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full mb-6 bg-[#0a0a0a] border-[rgba(255,255,255,0.15)] text-[#e5e5e5] hover:bg-[#222] hover:border-[rgba(255,255,255,0.3)] flex items-center justify-center gap-3"
          >
            <GoogleIcon />
            {googleLoading ? "Redirecting…" : "Sign in with Google"}
          </Button>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[rgba(255,255,255,0.1)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[#1a1a1a] px-3 text-[#a0a0a0]">or sign in with email</span>
            </div>
          </div>

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
              disabled={loading || googleLoading}
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
