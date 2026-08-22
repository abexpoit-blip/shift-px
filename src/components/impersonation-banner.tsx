import { useEffect, useState } from "react";
import { ShieldAlert, LogOut, Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import {
  exitImpersonation,
  getImpersonationFlag,
  type ImpersonationFlag,
} from "@/lib/impersonation";

export function ImpersonationBanner() {
  const [flag, setFlag] = useState<ImpersonationFlag | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const update = () => setFlag(getImpersonationFlag());
    update();

    window.addEventListener("storage", update);
    window.addEventListener("impersonation-change", update);
    const timer = setInterval(update, 1000);

    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("impersonation-change", update);
      clearInterval(timer);
    };
  }, []);

  if (!flag) return null;

  const handleExit = async () => {
    setBusy(true);
    try {
      await exitImpersonation();
      setFlag(null);
      toast.success("Exited user view — returning to admin panel");
      // Force clean navigation to reinitialize admin session
      window.location.href = "/control-panel";
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed top-0 inset-x-0 z-[9999] w-full bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700 text-white shadow-2xl border-b border-white/20 animate-in slide-in-from-top duration-300">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30">
            <UserCheck className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-black/30 border border-white/20">
                Admin Impersonation Mode
              </span>
              <span className="hidden sm:inline text-xs opacity-90">Viewing Publisher Dashboard</span>
            </div>
            <div className="text-xs sm:text-sm font-bold truncate mt-0.5">
              Logged in as: <span className="underline decoration-white/70 font-black">{flag.target_email}</span>
              {flag.admin_email && (
                <span className="opacity-75 font-normal ml-2">
                  (Admin: {flag.admin_email})
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={handleExit}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-white text-rose-700 px-4 py-2 text-xs sm:text-sm font-black hover:bg-white/90 hover:scale-105 active:scale-95 disabled:opacity-60 shadow-lg shadow-black/20 transition-all cursor-pointer"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
          Exit & Return to Admin
        </button>
      </div>
    </div>
  );
}
