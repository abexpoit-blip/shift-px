import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ShieldAlert, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exitImpersonation, getImpersonationFlag, type ImpersonationFlag } from "@/lib/impersonation";

export function ImpersonationBanner() {
  const [flag, setFlag] = useState<ImpersonationFlag | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setFlag(getImpersonationFlag());
    const onStorage = () => setFlag(getImpersonationFlag());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!flag) return null;

  const handleExit = async () => {
    setBusy(true);
    try {
      await exitImpersonation();
      setFlag(null);
      toast.success("Exited — back to admin");
      navigate({ to: "/control-panel" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sticky top-0 z-[60] w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-lg">
      <div className="max-w-[1600px] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-90">Admin Impersonation</div>
            <div className="text-sm font-semibold truncate">
              Signed in as <span className="underline decoration-white/50">{flag.target_email}</span>
              {flag.admin_email && (
                <span className="hidden sm:inline opacity-80 font-normal"> · admin: {flag.admin_email}</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleExit}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-white text-rose-600 px-3.5 py-2 text-sm font-bold hover:bg-white/95 disabled:opacity-60 shadow-md"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
          Exit & return to admin
        </button>
      </div>
    </div>
  );
}
