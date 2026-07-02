import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail } from "@/lib/api";
import { ArrowLeft, Lock } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md animate-fade-in-up">
        <button
          data-testid="back-home"
          onClick={() => navigate("/")}
          className="mb-6 flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </button>

        <div className="rounded-lg border border-gray-200 bg-white p-8">
          <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-md bg-gray-900 text-white">
            <Lock className="h-5 w-5" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Owner access</p>
          <h1 className="mt-2 text-3xl font-black tracking-tighter text-gray-900">Sign in to edit</h1>
          <p className="mt-2 text-sm text-gray-500">
            Only the owner can change data. Everyone else views in read-only mode.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">
                Email
              </label>
              <input
                data-testid="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">
                Password
              </label>
              <input
                data-testid="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p data-testid="login-error" className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                {error}
              </p>
            )}
            <button
              data-testid="login-submit"
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-gray-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}