"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  Bell,
  BellOff,
  Calendar,
  Check,
  CheckCircle,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Chrome,
  Circle,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Component,
  Copy,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Flame,
  Gem,
  Landmark,
  LayoutGrid,
  Key,
  Lock,
  LogOut,
  Mail,
  Medal,
  MessageSquare,
  Moon,
  MoreVertical,
  PartyPopper,
  Play,
  Plus,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Target,
  Trash2,
  Trophy,
  User,
  Users,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { LucideIcon } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  addTask,
  approveTransaction,
  activeForUser,
  bonusTaskCompletedForUser,
  completedForUser,
  deleteTask,
  formatDue,
  formatRelative,
  formatShortDate,
  isBonusSubmittedForUser,
  isSubmittedForUser,
  loginUser,
  loginWithGoogle,
  logoutUser,
  mainTaskCompletedForUser,
  markAllNotificationsRead,
  markNotificationRead,
  markTaskCompleted,
  withdrawSubmission,
  parseDate,
  registerUser,
  redeemValenciaCoupon,
  rejectTransaction,
  sendReset,
  toggleNotifications,
  updateAvatar,
  updateFullName,
  updateTask,
  uploadProof,
  useCurrentUser,
  useNotifications,
  useTasks,
  useUsers,
  VALENCIA_COUPON_COST,
} from "@/lib/data";
import { cn } from "@/lib/utils";
import { AppNotification, TaskModel, UserModel, VaultTransaction, VoucherModel } from "@/lib/types";

type AvatarPreset = {
  id: string;
  label: string;
  colors: [string, string];
  accent: string;
  skinTone: string;
  hairTone: string;
  accessory: "none" | "glasses" | "cap" | "star" | "hoop" | "headset" | "bow";
};

const avatarPresets: AvatarPreset[] = [
  { id: "preset:aurora", label: "Aurora", colors: ["#7A9BFF", "#B7C7FF"], accent: "#3955D8", skinTone: "#F2C6A0", hairTone: "#4A325D", accessory: "star" },
  { id: "preset:sol", label: "Sol", colors: ["#FFB85C", "#FFE2A7"], accent: "#DB6E18", skinTone: "#E9B48F", hairTone: "#40281C", accessory: "cap" },
  { id: "preset:mint", label: "Mint", colors: ["#64D6B3", "#BDF3DD"], accent: "#17896D", skinTone: "#F0C19A", hairTone: "#274239", accessory: "glasses" },
  { id: "preset:coral", label: "Coral", colors: ["#FF8F8F", "#FFD2C6"], accent: "#E54C6C", skinTone: "#E8B08E", hairTone: "#60312A", accessory: "bow" },
  { id: "preset:violet", label: "Violet", colors: ["#A78BFA", "#E8DEFF"], accent: "#6E46DC", skinTone: "#DCA986", hairTone: "#2B2344", accessory: "headset" },
  { id: "preset:sky", label: "Sky", colors: ["#67C4FF", "#CFEFFF"], accent: "#1673C8", skinTone: "#F2C9B0", hairTone: "#3A2F2B", accessory: "hoop" },
  { id: "preset:ember", label: "Ember", colors: ["#FF7461", "#FFC1A8"], accent: "#D13A2E", skinTone: "#E3A97F", hairTone: "#36211D", accessory: "none" },
];

function resolvePreset(avatarId?: string | null, fallbackSeed = "default") {
  const direct = avatarPresets.find((preset) => preset.id === avatarId);
  if (direct) return direct;
  const seed = avatarId ?? fallbackSeed;
  const index = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % avatarPresets.length;
  return avatarPresets[index];
}

/* ===================== ANIMATION HELPERS ===================== */
const pageVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.2, 0, 0, 1] } },
};

const staggerContainer = {
  hidden: { opacity: 1 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.2, 0, 0, 1] } },
};

const cardHover = { scale: 1.015, transition: { duration: 0.2 } };
const cardTap = { scale: 0.98, transition: { duration: 0.1 } };

function AnimatedCounter({ value, duration = 1.2 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(0);
  useEffect(() => {
    const start = ref.current;
    const diff = value - start;
    if (diff === 0) return;
    const startTime = performance.now();
    const ms = duration * 1000;
    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / ms, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + diff * eased);
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(tick);
      else ref.current = value;
    }
    requestAnimationFrame(tick);
  }, [value, duration]);
  return <>{display}</>;
}

/**
 * Hook to handle "Back" button to close modals on mobile/web
 */
function useModalHistory(isOpen: boolean, onClose: () => void, modalId: string) {
  useEffect(() => {
    if (!isOpen) return;

    // Push a new state when the modal opens
    const state = { modalId };
    window.history.pushState(state, "");

    const handlePopState = (event: PopStateEvent) => {
      // If the back button is pressed, close the modal
      onClose();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      // If the modal is closed via UI (not back button), remove the state we added
      if (window.history.state?.modalId === modalId) {
        window.history.back();
      }
    };
  }, [isOpen, onClose, modalId]);
}

function ConfettiCelebration() {
  const colors = ["#00A3FF", "#B9F474", "#FFD700", "#FF6B6B", "#A78BFA", "#9FF1EA", "#FFB85C", "#FF8F8F"];
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        color: colors[i % colors.length],
        fallDuration: `${2.5 + Math.random() * 2}s`,
        swayDuration: `${1.5 + Math.random() * 2}s`,
        delay: `${Math.random() * 1.2}s`,
        size: 6 + Math.random() * 8,
        shape: Math.random() > 0.5 ? "50%" : "2px",
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return (
    <>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            backgroundColor: p.color,
            width: p.size,
            height: p.size,
            borderRadius: p.shape,
            // @ts-expect-error css custom properties
            "--fall-duration": p.fallDuration,
            "--sway-duration": p.swayDuration,
            "--delay": p.delay,
          }}
        />
      ))}
    </>
  );
}

function CelebrationRings() {
  return (
    <>
      <div className="celebration-ring" />
      <div className="celebration-ring" />
      <div className="celebration-ring" />
    </>
  );
}

function FloatingSparkles({ count = 12 }: { count?: number }) {
  const sparks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        return {
          id: i,
          tx: `${Math.cos(angle) * (40 + Math.random() * 30)}px`,
          ty: `${Math.sin(angle) * (40 + Math.random() * 30)}px`,
          delay: `${i * 0.08}s`,
          duration: `${1.2 + Math.random() * 0.8}s`,
          size: 12 + Math.random() * 8,
        };
      }),
    [count],
  );
  return (
    <>
      {sparks.map((s) => (
        <Sparkles
          key={s.id}
          size={s.size}
          className="sparkle-particle text-primary"
          style={{
            // @ts-expect-error css custom properties
            "--tx": s.tx,
            "--ty": s.ty,
            "--delay": s.delay,
            "--duration": s.duration,
          }}
        />
      ))}
    </>
  );
}

function Screen({ children, className }: { children: React.ReactNode; className?: string }) {
  const router = useRouter();
  const handleRefresh = async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    router.refresh();
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <main className={cn("apk-screen", className)}>{children}</main>
    </PullToRefresh>
  );
}

function PullToRefresh({ children, onRefresh }: { children: React.ReactNode; onRefresh: () => Promise<void> }) {
  const [refreshing, setRefreshing] = useState(false);
  const pullY = useMotionValue(0);
  const springY = useSpring(pullY, { damping: 25, stiffness: 300 });

  const threshold = 90;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let startY = 0;
    let isPulling = false;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY <= 0) {
        startY = e.touches[0].pageY;
        isPulling = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling) return;
      const y = e.touches[0].pageY;
      const diff = y - startY;

      if (diff > 0 && window.scrollY <= 0) {
        // Logarithmic resistance for a more natural feel
        const d = Math.min(Math.pow(diff, 0.8) * 2.5, 120);
        pullY.set(d);
        if (e.cancelable && d > 5) e.preventDefault();
      } else if (diff < 0) {
        isPulling = false;
        pullY.set(0);
      }
    };

    const onTouchEnd = async () => {
      if (!isPulling) return;
      isPulling = false;

      if (pullY.get() >= threshold * 0.8) {
        setRefreshing(true);
        pullY.set(60);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          pullY.set(0);
        }
      } else {
        pullY.set(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [onRefresh, pullY, threshold]);

  const rotate = useTransform(pullY, [0, threshold], [0, 360]);
  const opacity = useTransform(pullY, [0, 30], [0, 1]);
  const scale = useTransform(pullY, [0, threshold], [0.8, 1]);
  const indicatorY = useTransform(pullY, [0, threshold], [0, 30]);

  return (
    <div ref={containerRef} className="relative overflow-hidden contain-paint">
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-[100] flex justify-center">
        <motion.div
          style={{
            y: refreshing ? 30 : indicatorY,
            opacity,
            scale,
            rotate: refreshing ? undefined : rotate,
          }}
          animate={refreshing ? { rotate: 360 } : {}}
          transition={refreshing ? { rotate: { repeat: Infinity, duration: 1, ease: "linear" } } : { type: "spring", damping: 20 }}
          className="mt-4 flex h-11 w-11 items-center justify-center rounded-full bg-surfaceContainerHigh text-primary shadow-[0_8px_30px_rgb(0,0,0,0.4)] ring-1 ring-white/10"
        >
          <RefreshCw size={20} className={cn(refreshing && "animate-spin-slow")} />
        </motion.div>
      </div>

      <motion.div style={{ y: springY }} className="relative z-10 origin-top">
        {children}
      </motion.div>
    </div>
  );
}

function SafeArea({ children, className, bottomNav = false }: { children: React.ReactNode; className?: string; bottomNav?: boolean }) {
  return <div className={cn("apk-safe pb-40", bottomNav && "pb-[180px]", className)}>{children}</div>;
}

function GhostCard({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
      whileHover={onClick ? cardHover : undefined}
      whileTap={onClick ? cardTap : undefined}
      className={cn(
        "apk-ghost rounded-[32px] border-outlineVariant/10 card-hover-lift",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

function BackHeader({ title, center = false, onClick }: { title?: string; center?: boolean; onClick?: () => void }) {
  const router = useRouter();
  return (
    <div className={cn("h-14 flex items-center", center ? "justify-center relative" : "gap-2")}>
      <button
        type="button"
        aria-label="Back"
        onClick={onClick || (() => (window.history.length > 1 ? router.back() : router.push("/")))}
        className={cn("w-11 h-11 rounded-full flex items-center justify-center text-onSurface active:bg-surfaceContainerHigh transition-colors", center && "absolute left-0")}
      >
        <ArrowLeft size={24} strokeWidth={2.5} />
      </button>
      {title ? <h1 className={cn("font-black text-xl", center && "text-center")}>{title}</h1> : null}
    </div>
  );
}

function AppButton({
  children,
  onClick,
  secondary = false,
  disabled = false,
  className,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <motion.button
      type={type}
      whileTap={{ scale: 0.98 }}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-14 w-full rounded-full px-6 text-base font-semibold transition disabled:opacity-60",
        secondary
          ? "bg-surfaceContainerLowest border border-outlineVariant/40 text-primary"
          : "apk-gradient shimmer text-white shadow-[0_8px_16px_rgba(0,93,167,0.2)]",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

function TextField({
  label,
  hint,
  icon: Icon,
  type = "text",
  value,
  onChange,
  readOnly,
  onClick,
  multiline,
}: {
  label: string;
  hint: string;
  icon?: LucideIcon;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  onClick?: () => void;
  multiline?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (visible ? "text" : "password") : type;
  const baseClass = cn(
    "w-full rounded-2xl bg-surfaceContainerHighest px-5 py-4 text-base text-onSurface placeholder:text-onSurfaceVariant/50 outline-none",
    "border border-transparent focus:border-outlineVariant/20",
    Icon && "pl-12",
    isPassword && "pr-12",
    multiline ? "min-h-32 resize-none" : "h-14",
  );

  return (
    <label className="block">
      <span className="block text-[11px] font-semibold tracking-[0.12em] text-onSurfaceVariant uppercase mb-2">{label}</span>
      <span className="relative block">
        {Icon ? <Icon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-onSurfaceVariant" /> : null}
        {multiline ? (
          <textarea className={baseClass} placeholder={hint} value={value} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input
            className={baseClass}
            placeholder={hint}
            type={inputType}
            value={value}
            readOnly={readOnly}
            onClick={onClick}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        {isPassword ? (
          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-outlineVariant"
            onClick={() => setVisible((state) => !state)}
          >
            {visible ? <Eye size={20} /> : <EyeOff size={20} />}
          </button>
        ) : null}
      </span>
    </label>
  );
}

function FormError({ message }: { message: string }) {
  const isSuccess = message.toLowerCase().includes("sent") || message.toLowerCase().includes("success");
  return (
    <AnimatePresence mode="wait">
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={cn(
            "mt-4 flex items-center gap-3 rounded-[20px] p-4 text-sm font-bold shadow-lg border",
            isSuccess
              ? "bg-green-500/10 text-green-500 border-green-500/20"
              : "bg-red-500/10 text-red-500 border-red-500/20"
          )}
        >
          <div className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            isSuccess ? "bg-green-500 text-white" : "bg-red-500 text-white"
          )}>
            {isSuccess ? <Check size={16} strokeWidth={3} /> : <XCircle size={16} strokeWidth={3} />}
          </div>
          <span className="flex-1">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ProfileAvatar({
  name,
  avatarId,
  size = 48,
  borderColor,
  borderWidth = 0,
  backgroundColor = "var(--surface-container-lowest)",
}: {
  name: string;
  avatarId?: string | null;
  size?: number;
  borderColor?: string;
  borderWidth?: number;
  backgroundColor?: string;
}) {
  const preset = resolvePreset(avatarId, name);
  const id = `grad-${preset.id.replace(/[:]/g, "-")}-${size}`;
  const accessory = (() => {
    if (preset.accessory === "glasses") {
      return (
        <>
          <circle cx="42" cy="52" r="7" fill="none" stroke="#111" strokeWidth="2.4" />
          <circle cx="58" cy="52" r="7" fill="none" stroke="#111" strokeWidth="2.4" />
          <path d="M49 52h2" stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
        </>
      );
    }
    if (preset.accessory === "cap") return <path d="M25 39c5-15 45-15 50 0H31v6h38v-6" fill={preset.accent} />;
    if (preset.accessory === "star") return <path d="M74 20l3 7 7 .7-5.4 4.8 1.7 7-6.3-3.7-6.2 3.7 1.6-7-5.4-4.8 7-.7z" fill={preset.accent} />;
    if (preset.accessory === "hoop") return <circle cx="64" cy="64" r="4" fill="none" stroke={preset.accent} strokeWidth="2.3" />;
    if (preset.accessory === "headset") {
      return (
        <>
          <path d="M28 48c1-21 43-21 44 0" fill="none" stroke={preset.accent} strokeWidth="3" strokeLinecap="round" />
          <circle cx="30" cy="52" r="4" fill={preset.accent} />
          <circle cx="70" cy="52" r="4" fill={preset.accent} />
        </>
      );
    }
    if (preset.accessory === "bow") return <path d="M28 28c-7-5-10 8-4 10 5-1 8-4 12-8 4 4 7 7 12 8 6-2 3-15-4-10-3 1-5 3-8 5-3-2-5-4-8-5z" fill={preset.accent} />;
    return null;
  })();

  return (
    <span
      className="inline-flex rounded-full"
      style={{
        padding: borderWidth,
        border: borderWidth ? `${borderWidth}px solid ${borderColor ?? "rgba(0,93,167,0.2)"}` : undefined,
        background: borderWidth ? "transparent" : backgroundColor,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100" className="rounded-full overflow-hidden block">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={preset.colors[0]} />
            <stop offset="100%" stopColor={preset.colors[1]} />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#${id})`} />
        <ellipse cx="50" cy="93" rx="45" ry="21" fill={preset.accent} opacity="0.95" />
        <ellipse cx="50" cy="52" rx="21" ry="25" fill={preset.skinTone} />
        <path d="M25 44c5-24 45-24 50 0 0 0-11-12-25-12S25 44 25 44z" fill={preset.hairTone} />
        <ellipse cx="50" cy="38" rx="25" ry="14" fill={preset.hairTone} />
        <circle cx="42" cy="52" r="2.8" fill="#1A1A1A" />
        <circle cx="58" cy="52" r="2.8" fill="#1A1A1A" />
        <path d="M43 62c4 7 10 7 14 0" fill="none" stroke="#3B2B2B" strokeWidth="2.8" strokeLinecap="round" />
        {accessory}
      </svg>
    </span>
  );
}

function AvatarTile({ preset, selected, onClick }: { preset: AvatarPreset; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[20px] p-3 border text-center transition shadow-sm",
        selected ? "bg-primary/10 border-primary shadow-[0_10px_18px_rgba(0,93,167,0.16)]" : "bg-surfaceContainerLowest border-outlineVariant/35",
      )}
    >
      <ProfileAvatar name={preset.label} avatarId={preset.id} size={52} />
      <span className={cn("mt-2 block truncate text-xs font-bold", selected ? "text-primary" : "text-onSurface")}>{preset.label}</span>
    </button>
  );
}

/* ===================== HELPERS ===================== */
function groupByPhase(tasks: TaskModel[]) {
  return tasks.reduce<Record<string, TaskModel[]>>((groups, task) => {
    groups[task.phase] = groups[task.phase] ?? [];
    groups[task.phase].push(task);
    return groups;
  }, {});
}

function LoadingScreen() {
  return (
    <Screen className="relative flex items-center justify-center overflow-hidden">
      <motion.div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-tertiaryContainer to-orange-400"
        initial={{ scaleX: 0, transformOrigin: "left" }}
        animate={{ scaleX: [0.15, 0.72, 0.35, 1] }}
        transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
      />
      <div className="w-full max-w-[360px] px-8 text-center">
        <motion.div
          className="relative mx-auto flex h-28 w-28 items-center justify-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
        >
          <motion.div
            className="absolute inset-0 rounded-[32px] border border-primary/20 bg-primary/10"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
          />
          <motion.div
            className="absolute inset-3 rounded-[26px] border border-tertiaryContainer/30 bg-tertiaryContainer/10"
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 7, ease: "linear" }}
          />
          <motion.div
            className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-surfaceContainerLowest shadow-[0_18px_40px_rgba(0,0,0,0.28)] ring-1 ring-outlineVariant/15"
            animate={{ y: [0, -5, 0] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          >
            <ClipboardCheck size={30} className="text-primary" />
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <p className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-primary">Valencia Nutrition Intern App</p>
          <h2 className="mt-3 text-2xl font-black leading-tight">Loading workspace</h2>
          <p className="mt-2 text-sm font-medium text-onSurfaceVariant">Syncing your tasks, credits, and reviews.</p>
        </motion.div>

        <div className="mx-auto mt-8 max-w-[280px] space-y-3">
          {[0, 1, 2].map((item) => (
            <motion.div
              key={item}
              className="h-3 rounded-full bg-surfaceContainerHigh"
              initial={{ opacity: 0.4, scaleX: 0.72 }}
              animate={{ opacity: [0.35, 0.9, 0.35], scaleX: [0.72, 1, 0.72] }}
              transition={{ repeat: Infinity, duration: 1.4, delay: item * 0.16, ease: "easeInOut" }}
              style={{ transformOrigin: "center" }}
            />
          ))}
        </div>
      </div>
    </Screen>
  );
}

function useProtectedUser() {
  const router = useRouter();
  const auth = useCurrentUser();
  React.useEffect(() => {
    if (!auth.loading && !auth.userData) router.replace("/");
    if (auth.userData?.email) {
      import("@/lib/data").then(m => m.registerPushNotifications(auth.userData!.email));
    }
  }, [auth.loading, auth.userData, router]);
  return auth;
}

function useProtectedAdmin() {
  const router = useRouter();
  const auth = useCurrentUser();

  React.useEffect(() => {
    if (auth.loading) return;

    if (!auth.userData) {
      // Not logged in or no Firestore profile
      router.replace("/admin/login");
      return;
    }

    if (auth.userData.role !== "Admin") {
      // Logged in but not an admin
      console.warn("Access denied: User is not an admin", auth.userData.email);
      router.replace("/dashboard");
    }
  }, [auth.loading, auth.userData, router]);

  return auth;
}

function SmallStat({ title, value, subtitle, icon: Icon, color, onClick }: { title: string; value: string; subtitle: string; icon: LucideIcon; color: string; onClick?: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
      whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.97 }}
      className="rounded-3xl border-2 p-5 text-left"
      style={{ backgroundColor: `${color}14`, borderColor: `${color}26` }}
    >
      <div className="flex items-center justify-between">
        <motion.span
          className="rounded-xl p-2"
          style={{ backgroundColor: `${color}26` }}
          animate={{ rotate: [0, -5, 5, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        >
          <Icon size={20} style={{ color }} />
        </motion.span>
        <ChevronRight size={16} style={{ color, opacity: 0.5 }} />
      </div>
      <div className="mt-5 text-[28px] font-black leading-none" style={{ color }}>{value}</div>
      <div className="mt-1 text-xs font-extrabold" style={{ color, opacity: 0.8 }}>{title}</div>
      <div className="text-[10px]" style={{ color, opacity: 0.6 }}>{subtitle}</div>
    </motion.button>
  );
}

function DashboardTaskCard({ task, user }: { task: TaskModel; user: UserModel }) {
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);

  // Use the global functions which now have fuzzy matching for transactions
  const isApproved = mainTaskCompletedForUser(task, user);
  const isSubmitted = isSubmittedForUser(task, user);

  // If approved, it's NEVER "under review"
  const showSubmitted = isSubmitted && !isApproved;

  return (
    <>
      <GhostCard className="overflow-hidden border-primary/10 border-2">
        <div className="flex items-center justify-between bg-primary/5 px-5 py-3">
          <div className="flex items-center gap-2 text-primary">
            <Component size={14} />
            <span className="text-[10px] font-black tracking-[0.12em] uppercase">{task.phase}</span>
          </div>
          {isApproved ? (
            <span className="rounded-lg bg-green-500/10 px-2.5 py-1 text-[10px] font-bold text-green-500">Approved</span>
          ) : showSubmitted ? (
            <span className="rounded-lg bg-orange-500/10 px-2.5 py-1 text-[10px] font-bold text-orange-500 flex items-center gap-1">
              <Clock size={10} /> Pending Review
            </span>
          ) : (
            <span className={cn("rounded-lg px-2.5 py-1 text-[10px] font-bold", formatDue(task.dueDate) === "Overdue" ? "bg-red-500/10 text-red-500" : "bg-tertiaryContainer text-onTertiaryContainer")}>{formatDue(task.dueDate)}</span>
          )}
        </div>
        <div className="p-5">
          <h3 className="text-lg font-bold">{task.title}</h3>
          <p className="mt-2 text-xs leading-relaxed text-onSurfaceVariant line-clamp-2">{task.description || "Complete this task to earn credits and climb the leaderboard."}</p>
          <div className="mt-5 flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-primary">
                <span className="rounded-full bg-primary/10 p-2">
                  <Award size={16} />
                </span>
                <span className="font-extrabold">{task.credits} Credits</span>
              </div>
              {showSubmitted && (
                <div className="flex items-center gap-1.5 ml-1 text-[10px] font-bold text-onSurfaceVariant/60 uppercase">
                   <Clock size={10} /> {formatDue(task.dueDate)} remaining
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowDetails(true)}
              className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg active:scale-95 transition-transform"
            >
              View Details
            </button>
          </div>
        </div>
      </GhostCard>

      <TaskDetailsModal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        task={task}
        user={user}
      />
    </>
  );
}

function SimpleTaskCard({ task, user }: { task: TaskModel; user: UserModel }) {
  const [showDetails, setShowDetails] = useState(false);

  // Use global functions with fuzzy matching
  const isApproved = mainTaskCompletedForUser(task, user);
  const isSubmitted = isSubmittedForUser(task, user);

  // Explicit priority
  const showSubmitted = isSubmitted && !isApproved;

  const tx = useMemo(() => {
    if (!user?.transactions) return null;
    const taskIdLower = task.id.toLowerCase();
    const taskTitleLower = (task.title || "").toLowerCase();

    return [...user.transactions].reverse().find(t => {
      if (t.isBonus) return false;
      const txTaskId = (t.taskId || "").toLowerCase();
      const txTitle = (t.title || t.description || "").toLowerCase();
      if (txTaskId === taskIdLower) return true;
      if (txTitle === taskTitleLower) return true;
      if (taskTitleLower.length > 3 && txTitle.includes(taskTitleLower)) return true;
      return false;
    });
  }, [user.transactions, task.id, task.title]);

  const isRejected = tx?.status === 'rejected';

  return (
    <>
      <GhostCard className="p-5" onClick={() => setShowDetails(true)}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-black tracking-[0.12em] text-onSurfaceVariant/60 uppercase">{task.phase}</span>
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">
            <Award size={14} />
            {task.credits}
          </span>
        </div>
        <h3 className="mt-3 text-lg font-bold text-onSurface">{task.title}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className={cn("rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wider", task.taskType === "Main Task" ? "bg-primary/10 text-primary" : "bg-surfaceContainerHigh text-onSurfaceVariant")}>{task.taskType}</span>
          {isApproved ? (
            <span className="rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-green-500/10 text-green-500">Approved</span>
          ) : showSubmitted ? (
            <span className="rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-orange-500/10 text-orange-500">Under Review</span>
          ) : isRejected ? (
            <span className="rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-red-500/10 text-red-500">Rejected / Action Required</span>
          ) : null}
          {tx && tx.proofUrls && tx.proofUrls.length > 0 && (
            <span className="flex items-center gap-1 rounded bg-surfaceContainerLow px-2 py-0.5 text-[10px] font-black text-primary uppercase tracking-wider">
              <FileText size={10} />
              {tx.proofUrls.length} {tx.proofUrls.length === 1 ? 'File' : 'Files'}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            {isApproved ? (
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-green-500" />
                <span className="text-sm font-bold text-green-500">Completed</span>
              </div>
            ) : showSubmitted ? (
              <>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-orange-500" />
                  <span className="text-sm font-bold text-orange-500">Awaiting Approval</span>
                </div>
                <div className="flex items-center gap-1.5 ml-6">
                  <Calendar size={12} className="text-onSurfaceVariant/40" />
                  <span className="text-[10px] font-bold text-onSurfaceVariant/60 uppercase">
                    Due: {formatDue(task.dueDate)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Clock size={16} className={cn(formatDue(task.dueDate) === "Overdue" ? "text-red-500" : "text-primary")} />
                <span className={cn("text-sm font-bold", formatDue(task.dueDate) === "Overdue" ? "text-red-500" : "text-primary")}>
                  {formatDue(task.dueDate)}
                </span>
              </div>
            )}
          </div>
          <ChevronRight size={16} className="text-onSurfaceVariant/30" />
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowDetails(true);
            }}
            className={cn(
              "h-12 w-full rounded-xl font-bold transition-all",
              isApproved ? "bg-green-500/10 text-green-500 border border-green-500/20" :
              isRejected ? "bg-red-500 text-white shadow-lg shadow-red-500/20" :
              showSubmitted ? "bg-orange-500/10 text-orange-500 border border-orange-500/20" :
              "bg-secondaryContainer text-onSecondaryContainer active:scale-[0.98]"
            )}
          >
            {isApproved ? "View Completed Task" : isRejected ? "Fix & Re-submit" : showSubmitted ? "View Submission" : "View Task Details"}
          </button>

          {tx && tx.proofUrls && tx.proofUrls.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetails(true);
              }}
              className="flex items-center justify-center gap-2 h-10 w-full rounded-xl border border-outlineVariant/20 bg-surfaceContainerLow text-[11px] font-black uppercase tracking-widest text-primary hover:bg-surfaceContainerHigh transition-colors"
            >
              <Eye size={14} />
              View My Evidence ({tx.proofUrls.length})
            </button>
          )}
        </div>
      </GhostCard>

      <TaskDetailsModal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        task={task}
        user={user}
      />
    </>
  );
}

type EvidenceKind = "image" | "video" | "csv" | "pdf" | "file";

function fileNameFromUrl(url?: string) {
  if (!url) return "File";
  try {
    const pathname = new URL(url).pathname;
    const decoded = decodeURIComponent(pathname);
    const filePart = decoded.split("/").filter(Boolean).pop() ?? "File";
    return filePart.replace(/^\d+_/, "") || "File";
  } catch {
    const cleaned = url.split("?")[0] ?? "";
    return decodeURIComponent(cleaned.split("/").pop() ?? "File").replace(/^\d+_/, "") || "File";
  }
}

function getEvidenceFileName(file?: File, name?: string, url?: string) {
  return name?.trim() || file?.name || fileNameFromUrl(url);
}

function inferEvidenceKind(file: File | undefined, displayName: string, url?: string): EvidenceKind {
  const source = `${file?.type ?? ""} ${displayName} ${url ?? ""}`.toLowerCase();
  if (file?.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|avif|heic|heif)$/i.test(displayName)) return "image";
  if (file?.type.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(displayName)) return "video";
  if (source.includes("text/csv") || /\.csv$/i.test(displayName)) return "csv";
  if (source.includes("application/pdf") || /\.pdf$/i.test(displayName)) return "pdf";
  return "file";
}

function FilePreviewItem({
  file,
  url,
  name,
  onRemove,
  isBonus = false
}: {
  file?: File;
  url?: string;
  name?: string;
  onRemove?: () => void;
  isBonus?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const displayName = getEvidenceFileName(file, name, url);
  const kind = inferEvidenceKind(file, displayName, url);
  const isImage = kind === "image";
  const isVideo = kind === "video";
  const isCSV = kind === "csv";
  const isPdf = kind === "pdf";

  useEffect(() => {
    if (file && file.type.startsWith('image/')) {
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
  }, [file]);

  const displayUrl = url || preview;
  const accentClass = isBonus ? "text-orange-500" : "text-primary";

  return (
    <div className={cn(
      "group relative flex min-w-0 flex-col items-center gap-2 rounded-2xl p-2 transition-all",
      isBonus ? "bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/10" : "bg-surfaceContainerHigh hover:bg-surfaceContainerHighest border border-outlineVariant/10"
    )}>
      <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-black/5 shadow-inner">
        {isImage && displayUrl ? (
          <img src={displayUrl} alt={displayName} className="h-full w-full object-cover transition-transform group-hover:scale-110" />
        ) : isVideo ? (
          <div className={cn("flex flex-col items-center", accentClass)}>
            <Play size={24} fill="currentColor" />
            <span className="mt-1 text-[8px] font-black uppercase">Video</span>
          </div>
        ) : isCSV ? (
          <div className={cn("flex flex-col items-center", accentClass)}>
            <FileText size={24} />
            <span className="text-[8px] font-black mt-1">CSV</span>
          </div>
        ) : isPdf ? (
          <div className={cn("flex flex-col items-center", accentClass)}>
            <FileText size={24} />
            <span className="mt-1 text-[8px] font-black uppercase">PDF</span>
          </div>
        ) : (
          <div className="flex flex-col items-center text-onSurfaceVariant/40">
            <FileText size={24} />
          </div>
        )}

        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 bg-black/10 flex items-center justify-center transition-colors hover:bg-black/30"
          >
            <div className="rounded-full bg-black/40 p-2 backdrop-blur-sm">
              <Eye size={18} className="text-white" />
            </div>
          </a>
        )}
      </div>

      <div className="flex w-full items-center justify-between px-1 gap-1">
        <span className="max-w-[64px] truncate text-[10px] font-bold text-onSurfaceVariant" title={displayName}>{displayName}</span>
        {onRemove ? (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            aria-label={`Remove ${displayName}`}
            className="text-onSurfaceVariant hover:text-red-500 transition-colors"
          >
            <XCircle size={14} />
          </button>
        ) : url ? (
          <a
            href={url}
            download={displayName}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${displayName}`}
            className="text-primary hover:text-primary/70 transition-colors"
          >
            <Download size={12} />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function TaskDetailsModal({
  isOpen,
  onClose,
  task,
  user,
}: {
  isOpen: boolean;
  onClose: () => void;
  task: TaskModel;
  user: UserModel;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState<{ isBonus: boolean } | null>(null);
  const [selectedMainFiles, setSelectedMainFiles] = useState<File[]>([]);
  const [selectedBonusFiles, setSelectedBonusFiles] = useState<File[]>([]);
  const [activeView, setActiveView] = useState<"main" | "bonus">("main");

  useModalHistory(isOpen, onClose, `task-${task.id}`);

  const mainDone = mainTaskCompletedForUser(task, user);
  const mainSubmitted = isSubmittedForUser(task, user) && !mainDone;
  const bonusDone = bonusTaskCompletedForUser(task, user);
  const bonusSubmitted = isBonusSubmittedForUser(task, user) && !bonusDone;

  // Find the proof if already submitted (Uses the same robust logic as mainTaskCompletedForUser)
  const mainTx = useMemo(() => {
    if (!user?.transactions) return null;
    const taskIdLower = task.id.toLowerCase();
    const taskTitleLower = (task.title || "").toLowerCase();

    // Find the best matching transaction (prioritize ID match, then title) - search latest first
    return [...user.transactions].reverse().find(t => {
      if (t.isBonus) return false;

      const txTaskId = (t.taskId || "").toLowerCase();
      const txTitle = (t.title || t.description || "").toLowerCase();

      // 1. Match by ID
      if (txTaskId === taskIdLower) return true;

      // 2. Match by exact title match (case insensitive)
      if (txTitle === taskTitleLower) return true;

      // 3. Match by containment
      if (taskTitleLower.length > 3 && txTitle.includes(taskTitleLower)) return true;
      if (txTitle.length > 3 && taskTitleLower.includes(txTitle)) return true;

      // 4. Keyword match: If the transaction contains at least two significant words
      const keywords = taskTitleLower.split(" ").filter(w => w.length > 3);
      if (keywords.length > 0) {
        const matchCount = keywords.filter(word => txTitle.includes(word)).length;
        if (matchCount >= Math.min(2, keywords.length)) return true;
      }

      return false;
    });
  }, [user.transactions, task.id, task.title]);

  const bonusTx = useMemo(() => {
    if (!user?.transactions) return null;
    const taskIdLower = task.id.toLowerCase();
    const taskTitleLower = (task.title || "").toLowerCase();

    return [...user.transactions].reverse().find(t => {
      if (!t.isBonus) return false;
      const txTaskId = (t.taskId || "").toLowerCase();
      const txTitle = (t.title || t.description || "").toLowerCase();

      // 1. Match by ID
      if (txTaskId === taskIdLower) return true;

      // 2. Match by exact title match (case insensitive)
      if (txTitle === taskTitleLower) return true;

      // 3. Match by containment
      if (taskTitleLower.length > 3 && txTitle.includes(taskTitleLower)) return true;
      if (txTitle.length > 3 && taskTitleLower.includes(txTitle)) return true;

      // 4. Keyword match
      const keywords = taskTitleLower.split(" ").filter(w => w.length > 3);
      if (keywords.length > 0) {
        const matchCount = keywords.filter(word => txTitle.includes(word)).length;
        if (matchCount >= Math.min(2, keywords.length)) return true;
      }

      return false;
    });
  }, [user.transactions, task.id, task.title]);

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = "hidden";
      // Clear selections when opening
      setSelectedMainFiles([]);
      setSelectedBonusFiles([]);
      setActiveView("main");
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isBonus: boolean) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (isBonus) {
        setSelectedBonusFiles(prev => [...prev, ...files]);
      } else {
        setSelectedMainFiles(prev => [...prev, ...files]);
      }
    }
  };

  const removeFile = (index: number, isBonus: boolean) => {
    if (isBonus) {
      setSelectedBonusFiles(prev => prev.filter((_, i) => i !== index));
    } else {
      setSelectedMainFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleWithdraw = async (isBonusSubmission: boolean) => {
    setWithdrawing(true);
    try {
      await withdrawSubmission(user, task, isBonusSubmission);
      setShowWithdrawConfirm(null);
    } catch (error) {
      console.error("Withdrawal failed:", error);
      alert("Failed to withdraw submission. Please try again.");
    } finally {
      setWithdrawing(false);
    }
  };

  const handleSubmit = async (isBonusSubmission: boolean) => {
    const filesToUpload = isBonusSubmission ? selectedBonusFiles : selectedMainFiles;
    if (filesToUpload.length === 0) {
      alert("Please upload at least one file as proof of work.");
      return;
    }

    // MIME type and Size validation
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    const ALLOWED_TYPES = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf', 'text/csv',
      'video/mp4', 'video/quicktime'
    ];

    for (const file of filesToUpload) {
      if (file.size > MAX_SIZE) {
        alert(`File "${file.name}" is too large. Max size is 5MB.`);
        return;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        // Fallback check for CSV if MIME type is missing or incorrect
        if (file.name.toLowerCase().endsWith('.csv')) continue;

        alert(`File "${file.name}" has an unsupported format. Please upload images, PDFs, CSVs, or MP4 videos.`);
        return;
      }
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const { urls, names } = await uploadProof(user.email, filesToUpload, (progress) => {
        setUploadProgress(Math.round(progress));
      });
      await markTaskCompleted(user, task, isBonusSubmission, urls, names);

      // Delay navigation slightly to let user see 100% progress
      setTimeout(() => {
        router.push(`/task-completed?taskId=${encodeURIComponent(task.id)}${isBonusSubmission ? '&bonus=1' : ''}&proof=1`);
        onClose();
      }, 500);
    } catch (error: any) {
      console.error("Submission failed:", error);
      alert(`Submission failed: ${error.message || "Unknown error"}. Please try again.`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  if (!isOpen || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <div style={{ display: "contents" }}>
      <ConfirmationModal
        isOpen={!!showWithdrawConfirm}
        onClose={() => setShowWithdrawConfirm(null)}
        onConfirm={() => showWithdrawConfirm && handleWithdraw(showWithdrawConfirm.isBonus)}
        title="Withdraw Submission?"
        message="Are you sure you want to withdraw your submission? This will allow you to re-upload evidence."
        confirmLabel={withdrawing ? "Withdrawing..." : "Withdraw"}
        isDestructive
        icon={Trash2}
      />
      <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-6" onClick={onClose}>
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[450px] rounded-t-[40px] sm:rounded-[40px] bg-surface p-8 shadow-2xl border-t sm:border border-outlineVariant/10 max-h-[90vh] flex flex-col relative"
        >
          <div className="sm:hidden absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-onSurfaceVariant/20 rounded-full" />

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-primary">
              {activeView === "bonus" ? (
                <button onClick={() => setActiveView("main")} className="flex items-center gap-2 hover:opacity-70 transition-opacity">
                  <ArrowLeft size={20} />
                  <span className="text-xs font-black tracking-widest uppercase">Back to Task</span>
                </button>
              ) : (
                <>
                  <Component size={16} />
                  <span className="text-xs font-black tracking-widest uppercase">{task.phase}</span>
                </>
              )}
            </div>
            <button onClick={onClose} className="h-10 w-10 rounded-full bg-surfaceContainerHighest flex items-center justify-center text-onSurface active:scale-90 transition-transform">
              {activeView === "bonus" ? <X size={20} /> : <ArrowLeft size={20} />}
            </button>
          </div>

          <div className="overflow-y-auto custom-scrollbar pr-2 pb-6">
            <AnimatePresence mode="wait">
              {activeView === "main" ? (
                <motion.div
                  key="main-view"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <h2 className="text-3xl font-black text-onSurface leading-tight">{task.title}</h2>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 rounded-2xl bg-primary/10 px-4 py-2 text-primary border border-primary/20">
                      <Award size={18} />
                      <span className="text-sm font-black">{task.credits} Credits</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl bg-surfaceContainerHigh px-4 py-2 text-onSurfaceVariant border border-outlineVariant/10">
                      <Calendar size={18} />
                      <span className="text-sm font-bold">{formatDue(task.dueDate)}</span>
                    </div>
                    {mainDone ? (
                      <div className="flex items-center gap-2 rounded-2xl bg-green-500/10 px-4 py-2 text-green-500 border border-green-500/20">
                        <CheckCircle size={18} />
                        <span className="text-sm font-bold">Approved</span>
                      </div>
                    ) : mainSubmitted ? (
                      <div className="flex items-center gap-2 rounded-2xl bg-orange-500/10 px-4 py-2 text-orange-500 border border-orange-500/20">
                        <Clock size={18} />
                        <span className="text-sm font-bold">Pending Review</span>
                      </div>
                    ) : null}
                  </div>

                  {mainTx?.proofUrls && mainTx.proofUrls.length > 0 && (
                    <div className="mt-8 bg-surfaceContainerLow rounded-3xl p-6 border border-outlineVariant/10">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-primary">Submitted Evidence</span>
                          <div className="flex items-center gap-1.5">
                            <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase",
                              mainTx.status === 'approved' ? "bg-green-500/10 text-green-500" :
                                mainTx.status === 'rejected' ? "bg-red-500/10 text-red-500" :
                                  "bg-orange-500/10 text-orange-500"
                            )}>
                              {mainTx.status}
                            </span>
                            <span className="text-[9px] font-bold text-onSurfaceVariant/40">• {formatShortDate(mainTx.date)}</span>
                          </div>
                        </div>
                        {!mainDone && mainTx.status === 'pending' && (
                          <button
                            disabled={withdrawing}
                            onClick={() => setShowWithdrawConfirm({ isBonus: false })}
                            className="text-[10px] font-black text-orange-500 uppercase hover:underline flex items-center gap-1 disabled:opacity-50"
                          >
                            {withdrawing ? <RefreshCw size={10} className="animate-spin" /> : <Trash2 size={10} />} Withdraw
                          </button>
                        )}
                      </div>

                      {mainTx.adminRemarks && (
                        <div className="mb-4 rounded-xl bg-red-500/5 border border-red-500/10 p-3">
                          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-red-500 mb-1">
                            <MessageSquare size={10} /> Feedback
                          </div>
                          <p className="text-xs text-onSurface leading-tight italic">{mainTx.adminRemarks}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-3">
                        {mainTx.proofUrls.map((url, i) => (
                          <FilePreviewItem
                            key={i}
                            url={url}
                            name={mainTx.proofNames?.[i]}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-8">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-onSurfaceVariant/60 mb-3">Task Brief & Instructions</h4>
                    <div className="rounded-3xl bg-surfaceContainerLow p-6 border border-outlineVariant/10">
                      <p className="text-base text-onSurface leading-relaxed whitespace-pre-wrap">
                        {task.description || "No specific instructions provided for this task. Please reach out to your supervisor if you're unsure about the requirements."}
                      </p>
                    </div>
                  </div>

                  {task.bonusAvailable && (
                    <button
                      onClick={() => setActiveView("bonus")}
                      className="mt-8 w-full group"
                    >
                      <div className={cn(
                        "rounded-3xl p-6 border transition-all text-left flex items-center justify-between",
                        bonusDone ? "bg-green-500/5 border-green-500/20" :
                          bonusSubmitted ? "bg-orange-500/5 border-orange-500/20" :
                            "bg-orange-500/5 border-orange-500/20 group-hover:bg-orange-500/10"
                      )}>
                        <div>
                          <div className={cn("flex items-center gap-2 mb-1",
                            bonusDone ? "text-green-500" : "text-orange-500"
                          )}>
                            <Sparkles size={18} />
                            <span className="text-sm font-black uppercase tracking-wider">Bonus Side Quest</span>
                          </div>
                          <p className="text-xs text-onSurfaceVariant font-bold">
                            {bonusDone ? "Successfully Completed!" : bonusSubmitted ? "Evidence Under Review" : "Earn extra credits"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={cn("text-sm font-black", bonusDone ? "text-green-500" : "text-orange-500")}>
                            +{task.bonusCredits}
                          </span>
                          <ChevronRight size={20} className={bonusDone ? "text-green-500" : "text-orange-500"} />
                        </div>
                      </div>
                    </button>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="bonus-view"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500">
                      <Sparkles size={24} />
                    </div>
                    <h2 className="text-2xl font-black text-onSurface leading-tight">Bonus Task</h2>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 rounded-2xl bg-orange-500/10 px-4 py-2 text-orange-500 border border-orange-500/20">
                      <Award size={18} />
                      <span className="text-sm font-black">{task.bonusCredits} Bonus Credits</span>
                    </div>
                    {bonusDone ? (
                      <div className="flex items-center gap-2 rounded-2xl bg-green-500/10 px-4 py-2 text-green-500 border border-green-500/20">
                        <CheckCircle size={18} />
                        <span className="text-sm font-bold">Approved</span>
                      </div>
                    ) : bonusSubmitted ? (
                      <div className="flex items-center gap-2 rounded-2xl bg-orange-500/10 px-4 py-2 text-orange-500 border border-orange-500/20">
                        <Clock size={18} />
                        <span className="text-sm font-bold">Pending Review</span>
                      </div>
                    ) : null}
                  </div>

                  {bonusTx?.proofUrls && bonusTx.proofUrls.length > 0 && (
                    <div className="mt-8 bg-surfaceContainerLow rounded-3xl p-6 border border-outlineVariant/10">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Submitted Proof</span>
                          <div className="flex items-center gap-1.5">
                            <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase",
                              bonusTx.status === 'approved' ? "bg-green-500/10 text-green-500" :
                                bonusTx.status === 'rejected' ? "bg-red-500/10 text-red-500" :
                                  "bg-orange-500/10 text-orange-500"
                            )}>
                              {bonusTx.status}
                            </span>
                            <span className="text-[9px] font-bold text-onSurfaceVariant/40">• {formatShortDate(bonusTx.date)}</span>
                          </div>
                        </div>
                        {!bonusDone && bonusTx.status === 'pending' && (
                          <button
                            disabled={withdrawing}
                            onClick={() => setShowWithdrawConfirm({ isBonus: true })}
                            className="text-[10px] font-black text-orange-500 uppercase hover:underline flex items-center gap-1 disabled:opacity-50"
                          >
                            {withdrawing ? <RefreshCw size={10} className="animate-spin" /> : <Trash2 size={10} />} Withdraw
                          </button>
                        )}
                      </div>

                      {bonusTx.adminRemarks && (
                        <div className="mb-4 rounded-xl bg-red-500/5 border border-red-500/10 p-3">
                          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-red-500 mb-1">
                            <MessageSquare size={10} /> Feedback
                          </div>
                          <p className="text-xs text-onSurface leading-tight italic">{bonusTx.adminRemarks}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-3">
                        {bonusTx.proofUrls.map((url, i) => (
                          <FilePreviewItem
                            key={i}
                            url={url}
                            name={bonusTx.proofNames?.[i]}
                            isBonus
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-8">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500/60 mb-3">Bonus Instructions</h4>
                    <div className="rounded-3xl bg-orange-500/5 p-6 border border-orange-500/10">
                      <p className="text-base text-onSurface leading-relaxed whitespace-pre-wrap">
                        {task.bonusDescription}
                      </p>
                    </div>
                  </div>

                  {!bonusDone && !bonusSubmitted && (
                    <div className="mt-8 bg-orange-500/5 rounded-3xl p-6 border border-orange-500/10">
                      <span className="text-[10px] font-black uppercase tracking-widest text-orange-500 block mb-4">Upload Bonus Evidence</span>
                      <input
                        type="file"
                        id="bonus-proof-upload"
                        className="hidden"
                        multiple
                        onChange={(e) => handleFileChange(e, true)}
                      />
                      <label
                        htmlFor="bonus-proof-upload"
                        className="flex flex-col items-center justify-center border-2 border-dashed border-orange-500/20 rounded-2xl p-8 cursor-pointer hover:bg-orange-500/10 transition-colors"
                      >
                        <Download size={32} className="text-orange-500 mb-3" />
                        <span className="text-sm font-bold text-onSurface text-center">
                          {selectedBonusFiles.length > 0 ? `${selectedBonusFiles.length} files selected` : "Select images or documents"}
                        </span>
                        <span className="text-xs text-onSurfaceVariant mt-2">Maximum file size: 5MB</span>
                      </label>

                      {selectedBonusFiles.length > 0 && !uploading && (
                        <div className="mt-6">
                          <div className="grid grid-cols-3 gap-3">
                            {selectedBonusFiles.map((f, i) => (
                              <FilePreviewItem
                                key={i}
                                file={f}
                                onRemove={() => removeFile(i, true)}
                                isBonus
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {uploading && (
                        <div className="mt-6">
                          <div className="flex items-center justify-between text-[10px] font-black uppercase text-orange-500 mb-2">
                            <span>Uploading Bonus Proof</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="h-2 w-full bg-orange-500/10 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-orange-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <button
                        disabled={uploading || selectedBonusFiles.length === 0}
                        onClick={() => handleSubmit(true)}
                        className="mt-6 w-full rounded-2xl bg-orange-500 py-4 font-black text-sm text-white shadow-lg active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {uploading ? <RefreshCw size={18} className="animate-spin" /> : <Check size={18} strokeWidth={3} />}
                        {uploading ? `Uploading ${uploadProgress}%` : "Submit Bonus Evidence"}
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-auto pt-6 flex flex-col gap-3">
            {activeView === "main" && (
              <>
                {!mainDone && !mainSubmitted && (
                  <div className="bg-surfaceContainerLow rounded-3xl p-4 border border-outlineVariant/10 mb-2">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-onSurfaceVariant">Proof of Completion</span>
                      {parseDate(task.dueDate).getTime() < Date.now() && (
                        <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                          <Clock size={10} /> Late (-50%)
                        </span>
                      )}
                    </div>
                    <input
                      type="file"
                      id="main-proof-upload"
                      className="hidden"
                      multiple
                      onChange={(e) => handleFileChange(e, false)}
                    />
                    <label
                      htmlFor="main-proof-upload"
                      className="flex flex-col items-center justify-center border-2 border-dashed border-outlineVariant/20 rounded-2xl p-4 cursor-pointer hover:bg-surfaceContainerHigh transition-colors"
                    >
                      <Download size={20} className="text-primary mb-2" />
                      <span className="text-xs font-bold text-onSurface text-center">
                        {selectedMainFiles.length > 0 ? `${selectedMainFiles.length} files selected` : "Select images, videos, or documents"}
                      </span>
                      <span className="text-[10px] text-onSurfaceVariant mt-1">Proof is required for validation</span>
                    </label>
                    {selectedMainFiles.length > 0 && !uploading && (
                      <div className="mt-4 grid grid-cols-4 gap-2">
                        {selectedMainFiles.map((f, i) => (
                          <FilePreviewItem
                            key={i}
                            file={f}
                            onRemove={() => removeFile(i, false)}
                          />
                        ))}
                      </div>
                    )}

                    {uploading && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase text-onSurfaceVariant mb-1">
                          <span>Uploading Evidence</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-surfaceContainerHigh rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  disabled={mainSubmitted || mainDone || uploading || (!mainSubmitted && selectedMainFiles.length === 0)}
                  onClick={() => handleSubmit(false)}
                  className="w-full rounded-[24px] bg-primary py-5 font-black text-sm text-white transition active:scale-95 flex items-center justify-center gap-3 shadow-[0_12px_24px_rgba(0,93,167,0.3)] disabled:opacity-50 disabled:grayscale"
                >
                  {mainDone ? <CheckCircle size={20} /> : (mainSubmitted || uploading) ? <Clock size={20} /> : <Check size={20} strokeWidth={3} />}
                  {mainDone ? "Approved & Completed" : uploading ? `Uploading ${uploadProgress}%` : mainSubmitted ? "Pending Admin Approval" : "Submit Task for Review"}
                </button>
              </>
            )}

            <button
              onClick={activeView === "bonus" ? () => setActiveView("main") : onClose}
              className="w-full rounded-[24px] bg-surfaceContainerHighest py-4 font-bold text-sm text-onSurface transition active:scale-95"
            >
              {activeView === "bonus" ? "Back to Task" : "Go Back"}
            </button>
          </div>

        </motion.div>
      </div>
    </div>,
    document.body
  );
}


export function RoleSelectorScreen() {
  const router = useRouter();
  const { userData, loading } = useCurrentUser();

  useEffect(() => {
    if (!loading && userData) {
      if (userData.role === "Admin") {
        router.replace("/admin/dashboard");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [userData, loading, router]);

  if (loading) return <LoadingScreen />;

  const roles = [
    { title: "Intern Workspace", description: "View dashboard, track task progress, and see cohort leaderboard as a user.", icon: User, path: "/sign-in" },
    { title: "Admin Hub", description: "Manage interns, create tasks, review submissions, and view intern metrics.", icon: ShieldCheck, path: "/admin/login" },
  ];
  return (
    <Screen className="flex items-center">
      <SafeArea className="py-10">
        <motion.div className="flex flex-col items-center text-center" variants={staggerContainer} initial="hidden" animate="visible">
          <motion.div variants={staggerItem} animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
            <img src="/assets/app_logo.png" alt="Valencia Nutrition" className="h-[120px] w-[120px] rounded-2xl object-contain" />
          </motion.div>
          <motion.h1 variants={staggerItem} className="mt-8 text-4xl font-extrabold leading-tight">Select Your Role</motion.h1>
          <motion.p variants={staggerItem} className="mt-3 text-base text-onSurfaceVariant">Choose an experience to preview the App.</motion.p>
          <div className="mt-16 w-full space-y-6 text-left">
            {roles.map((item, index) => (
              <motion.button
                key={item.title}
                type="button"
                onClick={() => router.push(item.path)}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.15, ease: [0.2, 0, 0, 1] }}
                whileHover={{ scale: 1.02, x: 4, transition: { duration: 0.2 } }}
                whileTap={{ scale: 0.98 }}
                className="apk-ghost flex w-full items-center rounded-3xl p-6 text-left shadow-[0_8px_24px_rgba(0,93,167,0.05)]"
              >
                <motion.span
                  className="rounded-2xl bg-primary/10 p-4 text-primary"
                  whileHover={{ rotate: [0, -10, 10, 0], transition: { duration: 0.4 } }}
                >
                  <item.icon size={32} />
                </motion.span>
                <span className="ml-6 flex-1">
                  <span className="block text-2xl font-semibold">{item.title}</span>
                  <span className="mt-2 block text-sm leading-relaxed text-onSurfaceVariant">{item.description}</span>
                </span>
                <motion.span animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}>
                  <ChevronRight className="ml-4 text-onSurfaceVariant" />
                </motion.span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </SafeArea>
    </Screen>
  );
}

export function SignInScreen() {
  const auth = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams?.get('registered') === 'true';

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (registered) {
      setMessage("Account created successfully! Please sign in.");
    }
  }, [registered]);

  // Auto-redirect if already logged in (but skip if we just registered)
  useEffect(() => {
    // Crucial: check the URL directly if searchParams is transient
    const urlParams = new URLSearchParams(window.location.search);
    const isJustRegistered = urlParams.get('registered') === 'true' || registered;

    if (!auth.loading && auth.userData && !isJustRegistered) {
      if (auth.userData.role === "Admin") {
        router.replace("/admin/dashboard");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [auth.loading, auth.userData, router, registered]);

  async function handleSignIn() {
    if (!email || !password) {
      setMessage("Please enter all fields.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await loginUser(email.trim(), password);
      router.push("/dashboard");
    } catch {
      setMessage("Invalid credentials or network error.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!email.trim()) {
      setMessage("Please enter your email address first.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await sendReset(email.trim());
      setMessage("A password reset link has been sent to your email.");
    } catch (error: any) {
      console.error("Reset Error:", error);
      setMessage(error.message || "Could not send reset link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <SafeArea className="pt-0">
        <BackHeader />
        <img src="/assets/app_logo.png" alt="Valencia Nutrition" className="mt-2 h-16 w-16 rounded-xl object-contain" />
        <h1 className="mt-8 text-[44px] font-bold leading-none">Welcome Back</h1>
        <p className="mt-3 text-base text-onSurfaceVariant">
          Resume your progress and distilled focus.
        </p>

        <div className="mt-12 space-y-6">
          <TextField label="WORK EMAIL" hint="alex.chen@distilled.com" icon={Mail} value={email} onChange={setEmail} />
          <TextField label="PASSWORD" hint="Enter your password" icon={Lock} type="password" value={password} onChange={setPassword} />
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={handleResetPassword} className="font-semibold text-primary">Forgot password?</button>
        </div>
        <FormError message={message} />
        <AppButton className="mt-10" disabled={loading} onClick={handleSignIn}>{loading ? "Signing In..." : "Sign In"}</AppButton>

        <button
          type="button"
          disabled={loading || auth.loading}
          onClick={async () => {
            setLoading(true);
            try {
              await loginWithGoogle();
              // The useCurrentUser effect will handle redirection
            } catch (err: any) {
              setMessage(err.message || "Google login failed.");
            } finally {
              setLoading(false);
            }
          }}
          className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl border border-outlineVariant/30 bg-surfaceContainerLowest font-semibold"
        >
          <Chrome size={24} className="mr-3" /> Continue with Google
        </button>
        <div className="mt-4 text-center">
          <button type="button" onClick={() => router.push("/admin/login")} className="text-onSurfaceVariant">Login as Admin</button>
        </div>
        <div className="mt-12 flex items-center justify-center text-sm">
          <span>Don't have an account?</span>
          <button type="button" onClick={() => router.push("/create-account")} className="ml-2 font-semibold text-primary">Create Account</button>
        </div>
      </SafeArea>
    </Screen>
  );
}

export function CreateAccountScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleCreate() {
    if (!name || !email || !password || !confirmPassword) return setMessage("Please enter all fields.");
    if (password !== confirmPassword) return setMessage("Passwords do not match.");
    if (password.length < 8) return setMessage("Password must be at least 8 characters.");
    setLoading(true);
    try {
      await registerUser(name.trim(), email.trim().toLowerCase(), password);
      // Use window.location.href to force a full reload and clear any transient Firebase auth states
      window.location.href = "/sign-in?registered=true";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <SafeArea className="pt-0">
        <BackHeader />
        <h1 className="mt-4 text-[44px] font-bold leading-none">Join the Cohort</h1>
        <p className="mt-3 text-base text-onSurfaceVariant">Begin your distilled workspace experience by creating an identifier.</p>
        <div className="mt-12 space-y-6">
          <TextField label="FULL NAME" hint="e.g. Alex Chen" icon={User} value={name} onChange={setName} />
          <TextField label="WORK EMAIL" hint="alex.chen@distilled.com" icon={Mail} value={email} onChange={setEmail} />
          <TextField label="CREATE PASSWORD" hint="Minimum 8 characters" icon={Lock} type="password" value={password} onChange={setPassword} />
          <TextField label="CONFIRM PASSWORD" hint="Repeat your password" icon={ShieldCheck} type="password" value={confirmPassword} onChange={setConfirmPassword} />
        </div>
        <FormError message={message} />
        <AppButton className="mt-12" disabled={loading} onClick={handleCreate}>{loading ? "Creating Account..." : "Create Account"}</AppButton>
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            try {
              await loginWithGoogle();
              router.push("/dashboard");
            } catch (err: any) {
              setMessage(err.message || "Google login failed.");
            }
          }}
          className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl border border-outlineVariant/30 bg-surfaceContainerLowest font-semibold"
        >
          <Chrome size={24} className="mr-3" /> Continue with Google
        </button>
        <p className="mt-6 text-center text-xs leading-relaxed text-onSurfaceVariant">By creating an account, you agree to the Workspace Terms of Service.</p>
      </SafeArea>
    </Screen>
  );
}

export function DashboardScreen() {
  const router = useRouter();
  const { userData, loading } = useProtectedUser();
  const tasksState = useTasks();
  const notifications = useNotifications(userData?.email);
  if (loading || !userData) return <LoadingScreen />;

  const myTasks = tasksState.data.filter((task) => task.assignedUserEmails.length === 0 || task.assignedUserEmails.includes(userData.email));
  const completedTasks = myTasks.filter((task) => completedForUser(task, userData)).length;
  const activeTasks = tasksState.data.filter((task) => activeForUser(task, userData));
  const pendingTasks = activeTasks.filter(task => isSubmittedForUser(task, userData) && !mainTaskCompletedForUser(task, userData)).length;
  const displayTasks = activeTasks.slice(0, 3);
  const progress = myTasks.length ? Math.round((completedTasks / myTasks.length) * 100) : 0;
  const unread = notifications.data.filter((item) => !item.isRead).length;

  return (
    <Screen>
      <SafeArea bottomNav>
        <motion.header
          className="flex items-center justify-between"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
        >
          <button type="button" onClick={() => router.push("/profile")} className="flex items-center gap-4 text-left">
            <ProfileAvatar name={userData.fullName} avatarId={userData.profilePictureUrl} size={44} borderWidth={2} borderColor="rgba(0,93,167,0.2)" />
            <h1 className="text-xl font-black">{userData.fullName || "Intern"}</h1>
          </button>
          <motion.button
            type="button"
            onClick={() => router.push("/notifications")}
            className="apk-ghost relative rounded-full p-3"
            animate={unread > 0 ? { rotate: [0, -15, 15, -10, 10, 0] } : {}}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            {unread > 0 ? <Bell size={20} className="text-primary" /> : <Bell size={20} />}
            {unread > 0 ? (
              <motion.span
                className="absolute right-2 top-2 h-4 min-w-4 rounded-full bg-red-500 px-1 text-[8px] font-bold text-white"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 15, delay: 0.6 }}
              >
                {unread}
              </motion.span>
            ) : null}
          </motion.button>
        </motion.header>
        <motion.div
          className="mt-8 grid grid-cols-2 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.2, 0, 0, 1] }}
        >
          <SmallStat title="Credits" value={`${userData.credits}`} subtitle={`${pendingTasks} Pending Review`} icon={Zap} color="#005DA7" onClick={() => router.push("/leaderboard")} />
          <SmallStat title="Progress" value={`${progress}%`} subtitle={`${completedTasks} of ${myTasks.length} tasks`} icon={Flame} color="#F59E0B" onClick={() => router.push("/performance")} />
        </motion.div>
        <motion.div
          className="mt-10 flex items-center justify-between"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.3, ease: [0.2, 0, 0, 1] }}
        >
          <h2 className="text-2xl font-extrabold">Priority Tasks</h2>
          <button type="button" onClick={() => router.push("/tasks")} className="flex items-center gap-1 font-bold text-primary">
            View All <ArrowRight size={14} />
          </button>
        </motion.div>
        <motion.div className="mt-3 space-y-5" variants={staggerContainer} initial="hidden" animate="visible">
          {tasksState.loading ? (
            <div className="py-10 text-center text-onSurfaceVariant">Loading tasks...</div>
          ) : activeTasks.length === 0 ? (
            <motion.div
              className="py-14 text-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, type: "spring" }}
            >
              <motion.div
                animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              >
                <PartyPopper size={48} className="mx-auto text-primary" />
              </motion.div>
              <h3 className="mt-4 font-bold">All Tasks Completed!</h3>
              <p className="text-sm text-onSurfaceVariant">You&apos;re ahead of the curve.</p>
            </motion.div>
          ) : (
            displayTasks.map((task, index) => (
              <motion.div key={task.id} variants={staggerItem} custom={index}>
                <DashboardTaskCard task={task} user={userData} />
              </motion.div>
            ))
          )}
        </motion.div>
      </SafeArea>
    </Screen>
  );
}

export function TasksScreen() {
  const { userData, loading } = useProtectedUser();
  const tasks = useTasks();
  const [tab, setTab] = useState<"active" | "completed">("active");
  if (loading || !userData) return <LoadingScreen />;

  const active = tasks.data.filter((task) => activeForUser(task, userData));
  const completed = tasks.data.filter((task) => completedForUser(task, userData));
  const visible = tab === "completed" ? completed : active;
  const grouped = groupByPhase(visible);
  const phases = Object.keys(grouped).sort();

  return (
    <Screen>
      <SafeArea bottomNav className="px-0">
        <motion.div className="px-6" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-[44px] font-bold leading-none">Action Items</h1>
        </motion.div>
        <div className="relative mt-6 grid grid-cols-2 border-b border-outlineVariant/25">
          {[
            ["active", "Active"],
            ["completed", "Completed"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value as typeof tab)}
              className={cn("relative py-4 text-sm font-semibold transition-colors", tab === value ? "text-primary" : "text-onSurfaceVariant")}
            >
              {label}
              {tab === value && (
                <motion.div
                  layoutId="taskTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
        <div className="px-6 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {phases.length === 0 ? (
                <div className="py-20 text-center text-onSurfaceVariant">{tab === "active" ? "No active tasks!" : "Completed tasks will appear here"}</div>
              ) : (
                <motion.div variants={staggerContainer} initial="hidden" animate="visible">
                  {phases.map((phase) => (
                    <motion.section key={phase} className="mb-8" variants={staggerItem}>
                      <div className="mb-4 flex items-center">
                        <span className={cn("h-6 w-1 rounded", tab === "completed" ? "bg-onTertiaryContainer/50" : "bg-primary")} />
                        <h2 className={cn("ml-3 text-sm font-bold uppercase tracking-[0.18em]", tab === "completed" ? "text-onTertiaryContainer/60" : "text-primary")}>{phase}</h2>
                        <span className="ml-2 text-xs text-onSurfaceVariant/50">({grouped[phase].length})</span>
                      </div>
                      <div className="space-y-6">
                        {grouped[phase].map((task) => (
                          <motion.div key={task.id} variants={staggerItem}>
                            <SimpleTaskCard task={task} user={userData} />
                          </motion.div>
                        ))}
                      </div>
                    </motion.section>
                  ))}
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </SafeArea>
    </Screen>
  );
}

export function LeaderboardScreen() {
  const router = useRouter();
  const { userData, loading } = useProtectedUser();
  const users = useUsers();
  if (loading || !userData) return <LoadingScreen />;
  const interns = users.data.filter((user) => user.role !== "Admin").sort((a, b) => b.credits - a.credits);

  return (
    <Screen>
      <SafeArea bottomNav>
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-[44px] font-black leading-none tracking-tight">Hall of Heroes</h1>
          <p className="mt-2 text-sm text-onSurfaceVariant">Top performers in the current cycle.</p>
        </motion.div>
        
        <motion.button
          type="button"
          onClick={() => router.push("/vault")}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="relative mt-8 w-full overflow-hidden rounded-[28px] bg-gradient-to-br from-primary to-[#00A3FF] p-6 text-left text-white shadow-[0_12px_24px_rgba(0,93,167,0.3)]"
        >
          <motion.div
            className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear", delay: 1 }}
          />
          <div className="relative z-10 flex items-center">
            <span className="rounded-2xl bg-white/20 p-3"><Gem size={28} /></span>
            <span className="ml-4 flex-1">
              <span className="block text-lg font-black">My Credit Vault</span>
              <span className="text-xs font-bold text-white/80">View History</span>
            </span>
            <span className="text-right">
              <span className="block text-[28px] font-black leading-none">
                <AnimatedCounter value={userData.credits} />
              </span>
              <span className="text-[10px] font-bold tracking-[0.2em] text-white/70">CREDITS</span>
            </span>
          </div>
        </motion.button>
        
        <motion.div
          className="mt-10 flex items-center gap-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Flame size={20} className="text-orange-500" />
          <h2 className="text-xl font-black">Rankings</h2>
        </motion.div>
        
        <motion.div className="mt-4 space-y-3" variants={staggerContainer} initial="hidden" animate="visible">
          {interns.map((intern, index) => {
            const isMe = intern.email === userData.email;
            const colors = ["#FFD700", "#9E9E9E", "#CD7F32"];
            if (index < 3) {
              const color = colors[index];
              const Icon = index === 0 ? Trophy : index === 1 ? Medal : Award;
              return (
                <motion.div key={intern.email} variants={staggerItem} className="rounded-3xl border-2 p-5" style={{ backgroundColor: `${color}1A`, borderColor: `${color}4D` }}>
                  <div className="flex items-center">
                    <span className="relative flex h-[42px] w-[42px] items-center justify-center rounded-full" style={{ backgroundColor: `${color}33` }}>
                      <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ repeat: Infinity, duration: 3, delay: index }}>
                        <Icon size={24} style={{ color }} />
                      </motion.div>
                    </span>
                    <span className="ml-3"><ProfileAvatar name={intern.fullName} avatarId={intern.profilePictureUrl} size={40} borderWidth={2} borderColor={`${color}55`} /></span>
                    <span className="ml-3 min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-black" style={{ color }}>{intern.fullName}</span>
                      <span className="text-[11px] font-bold" style={{ color, opacity: 0.7 }}>Rank {index + 1}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-lg font-black" style={{ color }}>{intern.credits}</span>
                      <span className="text-[9px] font-black" style={{ color, opacity: 0.6 }}>CREDITS</span>
                    </span>
                  </div>
                </motion.div>
              );
            }
            return (
              <motion.div key={intern.email} variants={staggerItem} className={cn("rounded-[20px] border p-4", isMe ? "border-primary/20 bg-primary/5" : "border-outlineVariant/10 bg-surfaceContainerLow")}>
                <div className="flex items-center">
                  <span className={cn("w-8 text-xs font-black", isMe ? "text-primary" : "text-onSurfaceVariant")}>#{index + 1}</span>
                  <ProfileAvatar name={intern.fullName} avatarId={intern.profilePictureUrl} size={32} />
                  <span className={cn("ml-3 flex-1 truncate text-sm font-semibold", isMe && "font-black text-primary")}>{intern.fullName}{isMe ? " (You)" : ""}</span>
                  <span className={cn("w-14 text-right text-sm font-black", isMe ? "text-primary" : "text-onSurface")}>{intern.credits}</span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </SafeArea>
    </Screen>
  );
}

export function VaultScreen() {
  const { userData, loading } = useProtectedUser();
  if (loading || !userData) return <LoadingScreen />;
  const txs = [...userData.transactions].reverse();
  const vouchers = [...userData.myVouchers].reverse();

  return (
    <Screen>
      <SafeArea>
        <BackHeader title="My Vault" />
        <motion.div
          className="mt-6 rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-8 text-center text-white shadow-[0_10px_20px_rgba(0,93,167,0.3)]"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, type: "spring" }}
        >
          <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}>
            <Landmark size={48} className="mx-auto" />
          </motion.div>
          <div className="mt-4 text-lg font-semibold text-white/90">Total Credits</div>
          <div className="mt-2 text-6xl font-bold">
            <AnimatedCounter value={userData.credits} />
          </div>
        </motion.div>

        <CreditRedemptionCard user={userData} />
        <VoucherHistory vouchers={vouchers} />
        
        <motion.h2
          className="mt-10 text-2xl font-semibold"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Transaction History
        </motion.h2>
        
        <motion.div className="mt-4 space-y-3" variants={staggerContainer} initial="hidden" animate="visible">
          {txs.length === 0 ? (
            <motion.p variants={staggerItem} className="pt-10 text-center text-onSurfaceVariant">No transactions yet.</motion.p>
          ) : (
            txs.map((tx) => (
              <motion.div key={tx.id} variants={staggerItem}>
                <TransactionCard tx={tx} />
              </motion.div>
            ))
          )}
        </motion.div>
      </SafeArea>
    </Screen>
  );
}

function CreditRedemptionCard({ user }: { user: UserModel }) {
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState("");
  const [revealedVoucher, setRevealedVoucher] = useState<VoucherModel | null>(null);
  const [copiedCode, setCopiedCode] = useState("");
  const copiedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const credits = Number(user.totalCredits ?? user.credits ?? 0);
  const progress = Math.min(Math.max((credits / VALENCIA_COUPON_COST) * 100, 0), 100);
  const creditsNeeded = Math.max(VALENCIA_COUPON_COST - credits, 0);
  const canRedeem = credits >= VALENCIA_COUPON_COST;

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopiedCode(""), 1400);
    } catch {
      setError("Could not copy the coupon code.");
    }
  };

  const handleRedeem = async () => {
    if (!canRedeem || redeeming) return;
    setRedeeming(true);
    setError("");
    setRevealedVoucher(null);
    try {
      const voucher = await redeemValenciaCoupon(user);
      setRevealedVoucher(voucher);
    } catch (err: any) {
      setError(err?.message ?? "Coupon redemption failed. Please try again.");
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <motion.section
      className="mt-6 overflow-hidden rounded-[32px] border border-purple-400/20 bg-surfaceContainerLow p-5 shadow-[0_18px_40px_rgba(88,28,135,0.18)]"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.12, ease: [0.2, 0, 0, 1] }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-300">Redemption</p>
          <h2 className="mt-2 text-2xl font-black leading-tight">Valencia Coupon</h2>
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-300">
          <Gem size={24} />
        </span>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <span>
          <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-onSurfaceVariant">Balance</span>
          <span className="mt-1 block text-3xl font-black leading-none">{credits.toLocaleString()}</span>
        </span>
        <span className="text-right">
          <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-onSurfaceVariant">Goal</span>
          <span className="mt-1 block text-sm font-black text-purple-300">{VALENCIA_COUPON_COST.toLocaleString()} credits</span>
        </span>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-surfaceContainerHighest">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-indigo-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: [0.2, 0, 0, 1] }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-onSurfaceVariant">
        <span>{Math.round(progress)}%</span>
        <span>{creditsNeeded > 0 ? `${creditsNeeded.toLocaleString()} left` : "Unlocked"}</span>
      </div>

      <div className="mt-6">
        <AnimatePresence mode="wait">
          {revealedVoucher ? (
            <motion.div
              key="coupon-reveal"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
              className="rounded-[26px] border border-green-400/20 bg-green-500/10 p-4"
            >
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 size={18} />
                <span className="text-xs font-black uppercase tracking-[0.18em]">Success</span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <code className="min-w-0 flex-1 truncate rounded-2xl bg-surfaceContainerLowest px-4 py-3 text-base font-black text-onSurface">
                  {revealedVoucher.code}
                </code>
                <button
                  type="button"
                  aria-label="Copy coupon code"
                  onClick={() => copyCode(revealedVoucher.code)}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-500 text-white active:scale-95 transition"
                >
                  {copiedCode === revealedVoucher.code ? <Check size={20} /> : <Copy size={20} />}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="redeem-button"
              type="button"
              disabled={!canRedeem || redeeming}
              onClick={handleRedeem}
              whileTap={canRedeem && !redeeming ? { scale: 0.98 } : undefined}
              animate={canRedeem && !redeeming ? { scale: [1, 1.012, 1] } : undefined}
              transition={canRedeem && !redeeming ? { repeat: Infinity, duration: 2.4, ease: "easeInOut" } : undefined}
              className={cn(
                "flex h-14 w-full items-center justify-center gap-2 rounded-[24px] px-5 text-sm font-black transition",
                canRedeem
                  ? "bg-gradient-to-r from-purple-600 via-fuchsia-500 to-indigo-500 text-white shadow-[0_14px_28px_rgba(168,85,247,0.28)]"
                  : "bg-surfaceContainerHighest text-onSurfaceVariant grayscale",
                (!canRedeem || redeeming) && "cursor-not-allowed opacity-70"
              )}
            >
              {redeeming ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Redeeming...
                </>
              ) : canRedeem ? (
                "Convert 2,000 credits"
              ) : (
                `Earn ${creditsNeeded.toLocaleString()} more to unlock.`
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {error ? (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-400"
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}

function VoucherHistory({ vouchers }: { vouchers: VoucherModel[] }) {
  const [copiedCode, setCopiedCode] = useState("");
  const copiedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopiedCode(""), 1400);
    } catch {
      setCopiedCode("");
    }
  };

  return (
    <motion.section
      className="mt-8"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.18, ease: [0.2, 0, 0, 1] }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">My Coupons</h2>
        <span className="rounded-full bg-purple-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-purple-300">
          {vouchers.length}
        </span>
      </div>

      <div className="mt-3 space-y-3">
        {vouchers.length === 0 ? (
          <p className="rounded-[24px] border border-outlineVariant/10 bg-surfaceContainerLow px-5 py-6 text-center text-sm font-semibold text-onSurfaceVariant">
            No coupons redeemed yet.
          </p>
        ) : (
          vouchers.map((voucher) => (
            <motion.div
              key={`${voucher.code}-${voucher.date}`}
              variants={staggerItem}
              className="flex items-center gap-3 rounded-[24px] border border-outlineVariant/10 bg-surfaceContainerLow p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-300">
                <Key size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black">{voucher.code}</span>
                <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-onSurfaceVariant">
                  {voucher.type} / {formatShortDate(voucher.date)}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Copy coupon ${voucher.code}`}
                onClick={() => copyCode(voucher.code)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surfaceContainerHighest text-onSurface active:scale-95 transition"
              >
                {copiedCode === voucher.code ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
              </button>
            </motion.div>
          ))
        )}
      </div>
    </motion.section>
  );
}

function TransactionCard({ tx }: { tx: VaultTransaction }) {
  const statusColor = tx.status === "pending" ? "#F97316" : tx.status === "rejected" ? "#EF4444" : "#22C55E";
  const Icon = tx.status === "pending" ? Clock : tx.status === "rejected" ? XCircle : CheckCircle;
  return (
    <GhostCard className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex min-w-0 items-start">
          <span className="rounded-full p-2" style={{ backgroundColor: `${statusColor}1A`, color: statusColor }}><Icon size={16} /></span>
          <span className="ml-3 min-w-0">
            <span className="block truncate font-bold">{tx.title}</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: statusColor }}>{tx.status}</span>
          </span>
        </div>
        <span className={cn("ml-3 text-xl font-black", tx.status === "rejected" ? "text-onSurfaceVariant" : "text-primary")}>{tx.status === "rejected" ? "" : "+"}{tx.amount}</span>
      </div>

      {tx.proofUrls && tx.proofUrls.length > 0 && (
        <div className="mt-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-onSurfaceVariant/60 block mb-2">My Evidence</span>
          <div className="flex flex-wrap gap-2">
            {tx.proofUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl bg-surfaceContainerLow px-3 py-2 text-[10px] font-bold text-primary hover:bg-surfaceContainerHigh transition-colors border border-outlineVariant/10"
              >
                <Download size={12} />
                <span className="truncate max-w-[100px]">{tx.proofNames?.[i] || `File ${i + 1}`}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {tx.adminRemarks ? (
        <div className="mt-4 rounded-lg border border-outlineVariant/50 bg-surfaceContainerLow p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-onSurfaceVariant">
            <MessageSquare size={12} /> {tx.adminName ? `Remarks from ${tx.adminName}` : "Admin Remarks"}
          </div>
          <p className="mt-1 text-sm italic">{tx.adminRemarks}</p>
        </div>
      ) : null}
    </GhostCard>
  );
}

export function PerformanceScreen() {
  const router = useRouter();
  const { userData, loading } = useProtectedUser();
  const tasks = useTasks();
  if (loading || !userData) return <LoadingScreen />;
  const myTasks = tasks.data.filter((task) => task.assignedUserEmails.length === 0 || task.assignedUserEmails.includes(userData.email));
  const completed = myTasks.filter((task) => completedForUser(task, userData)).length;
  const rate = myTasks.length ? Math.round((completed / myTasks.length) * 100) : 0;
  const phases = Object.entries(groupByPhase(myTasks)).sort(([a], [b]) => a.localeCompare(b));
  const lastRemark = [...userData.transactions].reverse().find((tx) => tx.adminRemarks);

  return (
    <Screen>
      <SafeArea className="pt-0">
        <BackHeader />
        <motion.h1
          className="mt-4 text-[44px] font-black leading-tight"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Performance Metrics
        </motion.h1>
        <motion.div
          className="mt-8 space-y-4"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div variants={staggerItem}>
            <StatDetail title="Completion Rate" value={`${rate}%`} icon={Target} bg="rgba(185,244,116,0.2)" color="var(--tertiary-container)" isPercentage />
          </motion.div>
          <motion.div variants={staggerItem}>
            <StatDetail title="Total Credits" value={`${userData.credits}`} icon={Award} bg="rgba(0,163,255,0.1)" color="var(--primary)" />
          </motion.div>
        </motion.div>
        
        <motion.h2
          className="mt-8 text-2xl font-black"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Performance Trend
        </motion.h2>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3, type: "spring" }}
        >
          <TrendCard transactions={userData.transactions} />
        </motion.div>
        
        <motion.h2
          className="mt-8 text-2xl font-black"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          Phase Progression
        </motion.h2>
        <motion.div className="mt-4 space-y-3" variants={staggerContainer} initial="hidden" animate="visible">
          {phases.length === 0 ? (
            <GhostCard className="p-8 text-center text-onSurfaceVariant">No phases available yet</GhostCard>
          ) : (
            phases.map(([phase, phaseTasks], index) => {
              const count = phaseTasks.filter((task) => completedForUser(task, userData)).length;
              const progress = phaseTasks.length ? count / phaseTasks.length : 0;
              const complete = progress === 1;
              return (
                <motion.div key={phase} variants={staggerItem}>
                  <GhostCard className="p-4" onClick={() => router.push(`/phase-detail/${encodeURIComponent(phase)}`)}>
                    <div className="flex items-center">
                      <motion.span
                        className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold", complete ? "bg-primary text-white" : "bg-surfaceContainerHigh")}
                        whileHover={{ rotate: complete ? [0, -10, 10, 0] : 0 }}
                      >
                        {complete ? <Check size={16} /> : index + 1}
                      </motion.span>
                      <span className="ml-4 flex-1">
                        <span className="flex items-center justify-between text-sm font-bold">
                          {phase}
                          <span className={complete ? "text-primary" : "text-onSurfaceVariant"}>{Math.round(progress * 100)}% <ChevronRight size={14} className="inline" /></span>
                        </span>
                        <span className="mt-2 block h-1.5 overflow-hidden rounded bg-surfaceContainerHigh">
                          <motion.span
                            className={cn("block h-full rounded", complete ? "bg-primary" : "bg-onSurfaceVariant/50")}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress * 100}%` }}
                            transition={{ duration: 1, delay: 0.5 + index * 0.1, ease: "easeOut" }}
                          />
                        </span>
                      </span>
                    </div>
                  </GhostCard>
                </motion.div>
              );
            })
          )}
        </motion.div>
        
        <motion.h2
          className="mt-8 text-2xl font-black"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          Latest Feedback
        </motion.h2>
        <motion.div
          className="mt-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          {lastRemark ? (
            <GhostCard className="p-6">
              <div className="flex items-center gap-2 text-xs text-onSurfaceVariant"><MessageSquare size={16} className="text-primary" /> {lastRemark.title}</div>
              <p className="mt-3 italic leading-relaxed">&quot;{lastRemark.adminRemarks}&quot;</p>
              <p className="mt-4 text-xs text-onSurfaceVariant">- Admin Review</p>
            </GhostCard>
          ) : (
            <p className="p-8 text-center text-onSurfaceVariant">No feedback received yet. Keep up the good work!</p>
          )}
        </motion.div>
      </SafeArea>
    </Screen>
  );
}

function StatDetail({ title, value, icon: Icon, bg, color, isPercentage }: { title: string; value: string; icon: LucideIcon; bg: string; color: string; isPercentage?: boolean }) {
  const numericValue = parseInt(value.replace(/\D/g, ""), 10) || 0;
  return (
    <GhostCard className="p-6">
      <div className="flex items-center">
        <motion.span
          className="rounded-xl p-3"
          style={{ background: bg, color }}
          whileHover={{ rotate: [0, -10, 10, 0] }}
          transition={{ duration: 0.5 }}
        >
          <Icon size={24} />
        </motion.span>
        <span className="ml-4">
          <span className="block text-sm text-onSurfaceVariant">{title}</span>
          <span className="mt-1 block text-[28px] font-black leading-none">
            <AnimatedCounter value={numericValue} />{isPercentage ? "%" : ""}
          </span>
        </span>
      </div>
    </GhostCard>
  );
}

function TrendCard({ transactions }: { transactions: VaultTransaction[] }) {
  const approved = [...transactions].sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime()).filter((tx) => tx.status === "approved");
  let sum = 0;
  const points = approved.map((tx) => (sum += tx.amount));
  if (points.length === 1) points.unshift(0);
  const max = Math.max(...points, 1);
  const path = points.length
    ? points.map((point, index) => `${index === 0 ? "M" : "L"} ${(index / Math.max(points.length - 1, 1)) * 100} ${90 - (point / max) * 80}`).join(" ")
    : "";
  return (
    <GhostCard className="mt-4 h-[220px] p-6">
      {points.length === 0 ? (
        <div className="flex h-full items-center justify-center text-onSurfaceVariant">No transaction data for trends</div>
      ) : (
        <>
          <div className="flex justify-between text-xs">
            <span className="text-onSurfaceVariant">Credit Accumulation</span>
            <span className="font-black text-primary"><AnimatedCounter value={points[points.length - 1]} /> total</span>
          </div>
          <svg viewBox="0 0 100 100" className="mt-5 h-32 w-full overflow-visible">
            <motion.path
              d={`${path} L 100 100 L 0 100 Z`}
              fill="rgba(0,163,255,0.1)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.5 }}
            />
            <motion.path
              d={path}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />
            {points.map((point, index) => (
              <motion.circle
                key={index}
                cx={(index / Math.max(points.length - 1, 1)) * 100}
                cy={90 - (point / max) * 80}
                r="3.5"
                fill="var(--primary)"
                stroke="var(--surface)"
                strokeWidth="1.5"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.4, delay: 1 + index * 0.1, type: "spring" }}
              />
            ))}
          </svg>
        </>
      )}
    </GhostCard>
  );
}

export function PhaseDetailScreen({ phaseName }: { phaseName?: string }) {
  const { userData, loading } = useProtectedUser();
  const tasks = useTasks();
  if (loading || !userData) return <LoadingScreen />;
  const phase = decodeURIComponent(phaseName ?? "Phase");
  const phaseTasks = tasks.data.filter((task) => task.phase === phase);
  const completed = phaseTasks.filter((task) => completedForUser(task, userData)).length;
  const progress = phaseTasks.length ? completed / phaseTasks.length : 0;

  return (
    <Screen>
      <SafeArea className="pt-0">
        <BackHeader title={phase} />
        {phaseTasks.length === 0 ? (
          <div className="flex min-h-[70vh] flex-col items-center justify-center text-center text-onSurfaceVariant">
            <ClipboardList size={64} className="opacity-40" />
            <p className="mt-4">No requirements listed for this phase yet.</p>
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-[32px] bg-gradient-to-br from-primary to-primary/60 p-6 text-white shadow-[0_10px_20px_rgba(0,163,255,0.2)]">
              <div className="flex items-center justify-between">
                <span className="text-lg font-black text-white/90">Overall Progress</span>
                <span className="text-3xl font-black">{Math.round(progress * 100)}%</span>
              </div>
              <span className="mt-5 block h-3 overflow-hidden rounded-full bg-white/20">
                <span className="block h-full rounded-full bg-white" style={{ width: `${progress * 100}%` }} />
              </span>
              <p className="mt-4 text-sm font-bold text-white/80">{completed} of {phaseTasks.length} requirements completed</p>
            </div>
            <h2 className="mt-8 text-xl font-black">Requirements</h2>
            <div className="mt-4 space-y-4">
              {phaseTasks.map((task) => {
                const done = completedForUser(task, userData);
                return (
                  <GhostCard key={task.id} className={cn("p-4 border", done ? "border-primary/50" : "border-outlineVariant/10")}>
                    <div className="flex items-center">
                      <span className={cn("rounded-full p-2.5", done ? "bg-primary/10 text-primary" : "bg-surfaceContainerHigh text-outlineVariant")}>{done ? <CheckCircle2 size={24} /> : <Circle size={24} />}</span>
                      <span className="ml-4 flex-1">
                        <span className={cn("block font-black", done && "text-onSurfaceVariant/50 line-through")}>{task.title}</span>
                        {!done && (
                          <span className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider mb-1 px-2 py-0.5 rounded-full",
                            formatDue(task.dueDate) === "Overdue" ? "text-red-500 bg-red-500/10" : "text-primary bg-primary/10"
                          )}>
                            <Clock size={10} />
                            Due: {formatDue(task.dueDate)}
                          </span>
                        )}
                        {task.description ? <span className="mt-1 block line-clamp-2 text-xs text-onSurfaceVariant">{task.description}</span> : null}
                      </span>
                      <span className="text-right text-sm font-black text-primary">{task.credits} pts</span>
                    </div>
                  </GhostCard>
                );
              })}
            </div>
          </>
        )}
      </SafeArea>
    </Screen>
  );
}

export function NotificationsScreen() {
  const { userData, loading: userLoading } = useProtectedUser();
  const { data: notifications, loading: notificationsLoading } = useNotifications(userData?.email);

  if (userLoading || !userData) return <LoadingScreen />;

  const hasNotifications = notifications && notifications.length > 0;

  return (
    <Screen>
      <SafeArea className="px-0 pt-0">
        <div className="flex items-center justify-between pr-6">
          <BackHeader title="Notifications" />
          {hasNotifications && (
            <button
              type="button"
              className="text-sm font-bold text-primary hover:opacity-80 active:opacity-60 transition-all"
              onClick={() => markAllNotificationsRead(userData.email, notifications)}
            >
              Mark all read
            </button>
          )}
        </div>

        {notificationsLoading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !hasNotifications ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] bg-surfaceContainerLow border border-outlineVariant/10">
              <BellOff size={32} className="text-onSurfaceVariant/20" />
            </div>
            <h3 className="text-lg font-bold text-onSurface">All caught up!</h3>
            <p className="mt-1 text-onSurfaceVariant text-sm font-medium">No new notifications here.</p>
          </div>
        ) : (
          <div className="space-y-3 px-4 py-2 pb-24">
            {notifications.map((notification) => (
              <NotificationTile
                key={notification.id}
                notification={notification}
                userEmail={userData.email}
              />
            ))}
          </div>
        )}
      </SafeArea>
    </Screen>
  );
}

function NotificationTile({ notification, userEmail }: { notification: AppNotification; userEmail: string }) {
  const palette: Record<string, [LucideIcon, string]> = {
    task_new: [PlusCircle, "#00A3FF"],
    task_deadline_soon: [Clock, "#F97316"],
    task_missed: [Clock, "#EF4444"],
    review_needed: [ClipboardCheck, "#A855F7"],
    credits_approved: [Zap, "#22C55E"],
    credits_rejected: [XCircle, "#EF4444"],
  };

  const [Icon, color] = palette[notification.type] ?? [Bell, "#00A3FF"];

  return (
    <button
      type="button"
      onClick={() => !notification.isRead && markNotificationRead(userEmail, notification.id)}
      className={cn(
        "w-full rounded-[28px] border p-5 text-left transition-all active:scale-[0.98]",
        notification.isRead
          ? "border-outlineVariant/5 bg-surface/40 opacity-70"
          : "border-primary/20 bg-surfaceContainerLow shadow-lg shadow-primary/5"
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className="shrink-0 rounded-[18px] p-3"
          style={{ backgroundColor: `${color}15`, color }}
        >
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              "block text-base leading-tight",
              notification.isRead ? "font-bold text-onSurface/60" : "font-black text-onSurface"
            )}>
              {notification.title}
            </span>
            {!notification.isRead && (
              <div className="h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_8px_rgba(0,163,255,0.6)]" />
            )}
          </div>
          <p className="mt-1 block text-sm text-onSurfaceVariant font-medium leading-relaxed line-clamp-2">
            {notification.message}
          </p>
          {notification.metadata?.remarks && (
            <div className="mt-3 rounded-2xl bg-surfaceContainerHigh/50 p-3 border border-outlineVariant/10">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-primary mb-1">
                <MessageSquare size={12} /> Admin Note
              </div>
              <p className="text-xs italic text-onSurface/80 leading-relaxed">
                &quot;{String(notification.metadata.remarks)}&quot;
              </p>
            </div>
          )}
          <span className="mt-3 block text-[10px] font-black text-onSurfaceVariant/30 uppercase tracking-[0.1em]">
            {formatRelative(notification.timestamp)}
          </span>
        </div>
      </div>
    </button>
  );
}

function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = false,
  icon: Icon,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  icon?: LucideIcon;
}) {
  const [mounted, setMounted] = useState(false);

  useModalHistory(isOpen, onClose, "confirmation");

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "unset";
      document.body.style.touchAction = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
      document.body.style.touchAction = "unset";
    };
  }, [isOpen]);

  if (!isOpen || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#0D0E11]/80 backdrop-blur-sm p-6" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[320px] rounded-[32px] bg-[#1A1C1E] p-6 shadow-2xl border border-white/5"
      >
        {Icon && (
          <div className={cn(
            "flex h-16 w-16 items-center justify-center rounded-2xl mb-4 mx-auto",
            isDestructive ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"
          )}>
            <Icon size={32} />
          </div>
        )}
        <h3 className="text-xl font-bold text-center text-white">{title}</h3>
        <p className="mt-2 text-onSurfaceVariant text-center text-sm leading-relaxed">{message}</p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={cn(
              "w-full rounded-2xl py-3.5 font-bold text-sm text-white transition active:scale-95",
              isDestructive ? "bg-red-500" : "bg-primary"
            )}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-white/5 py-3.5 font-bold text-sm text-onSurfaceVariant transition active:scale-95"
          >
            {cancelLabel}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

export function ProfileScreen({ admin = false }: { admin?: boolean }) {
  const router = useRouter();
  const { userData, loading } = useProtectedUser();
  const [light, setLight] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  if (loading || !userData) return <LoadingScreen />;
  if (admin && userData.role !== "Admin") {
    router.replace("/dashboard");
    return <LoadingScreen />;
  }

  function toggleThemeLocal() {
    const next = !light;
    setLight(next);

    const updateTheme = () => {
      document.documentElement.classList.toggle("light", next);
      localStorage.setItem("theme", next ? "light" : "dark");
    };

    if (!document.startViewTransition) {
      updateTheme();
      return;
    }

    document.documentElement.classList.add("theme-transitioning");
    const transition = document.startViewTransition(updateTheme);
    transition.finished.finally(() => {
      document.documentElement.classList.remove("theme-transitioning");
    });
  }

  return (
    <Screen>
      <SafeArea bottomNav className="pt-0">
        <BackHeader title={admin ? "Admin Profile" : "Profile"} />

        <motion.div
          className={cn(
            "mt-8 mx-4 rounded-[40px] p-10 relative overflow-hidden",
            admin
              ? "bg-gradient-to-br from-primary/20 via-surface to-surface border border-primary/20"
              : "bg-surfaceContainerLow border border-white/5 shadow-2xl"
          )}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, type: "spring" }}
        >
          <div className="flex flex-col items-center text-center relative z-10">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative"
            >
              <ProfileAvatar
                name={userData.fullName}
                avatarId={userData.profilePictureUrl}
                size={admin ? 140 : 120}
                borderWidth={6}
                borderColor="rgba(255,255,255,0.05)"
              />
              <div className="absolute -bottom-1 -right-1 bg-primary p-2.5 rounded-2xl shadow-lg border-4 border-surface">
                <User size={20} className="text-white" />
              </div>
            </motion.div>

            <div className="mt-8">
              <h1 className="text-4xl font-black tracking-tight leading-none">{userData.fullName || (admin ? "Supervisor" : "Intern")}</h1>
              <p className="mt-3 text-lg font-bold text-onSurfaceVariant/50 font-mono tracking-tight">{userData.email}</p>

              <div className="mt-6 flex gap-2 justify-center">
                <span className="px-5 py-2 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-widest border border-primary/20">
                  {userData.role}
                </span>
                {!admin && (
                  <span className="px-5 py-2 rounded-full bg-green-500/10 text-green-500 text-xs font-black uppercase tracking-widest border border-green-500/20">
                    {userData.credits} Credits
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Decorative background blur */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-[100px]" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px]" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="px-4"
        >
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-onSurfaceVariant/40 mt-12 mb-4 px-2">Settings & Security</h2>
          <GhostCard className="overflow-hidden border border-white/5 bg-surfaceContainerLow/50 backdrop-blur-sm rounded-[32px]">
            <SettingsRow icon={light ? Sun : Moon} title="Dark Mode" right={<Switch checked={!light} onChange={toggleThemeLocal} />} onClick={toggleThemeLocal} />
            <Divider className="opacity-50" />
            <SettingsRow
              icon={userData.notificationsEnabled ? Bell : BellOff}
              title="Notifications"
              right={<Switch checked={userData.notificationsEnabled} onChange={() => toggleNotifications(userData.email, !userData.notificationsEnabled)} />}
              onClick={() => toggleNotifications(userData.email, !userData.notificationsEnabled)}
            />
            <Divider className="opacity-50" />
            <SettingsRow
              icon={Lock}
              title="Account Security"
              onClick={() => setShowSecurityModal(true)}
            />
            <Divider className="opacity-50" />
            {admin ? (
              <>
                <SettingsRow icon={Users} title="Manage Interns" onClick={() => router.push("/admin/interns")} />
                <Divider className="opacity-50" />
                <SettingsRow
                  icon={Download}
                  title={exportingReport ? "Exporting Report" : "Export Reports"}
                  right={exportingReport ? <RefreshCw size={18} className="animate-spin text-primary" /> : undefined}
                  onClick={async () => {
                    if (exportingReport) return;
                    setExportingReport(true);
                    try {
                      const { exportLatestInternReportCSV } = await import("@/lib/reports");
                      await exportLatestInternReportCSV();
                    } catch (error) {
                      console.error("Report export failed:", error);
                      window.alert("Failed to export report. Please check your connection and try again.");
                    } finally {
                      setExportingReport(false);
                    }
                  }}
                />
                <Divider className="opacity-50" />
              </>
            ) : null}
            <SettingsRow
              icon={LogOut}
              title="Log Out"
              destructive
              onClick={() => setShowLogoutConfirm(true)}
            />
          </GhostCard>
        </motion.div>
      </SafeArea>

      <ProfileSettingsModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        user={userData}
      />

      <ConfirmationModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={async () => {
          await logoutUser();
          router.push(admin ? "/admin/login" : "/sign-in");
        }}
        title="Logging Out?"
        message="Are you sure you want to sign out of your account?"
        confirmLabel="Log Out"
        isDestructive
        icon={LogOut}
      />
    </Screen>
  );
}

function ProfileSettingsModal({ isOpen, onClose, user }: { isOpen: boolean; onClose: () => void; user: UserModel }) {
  const [name, setName] = useState(user.fullName);
  const [avatar, setAvatar] = useState(user.profilePictureUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [mounted, setMounted] = useState(false);

  useModalHistory(isOpen, onClose, "profile-settings");

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "unset";
      document.body.style.touchAction = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
      document.body.style.touchAction = "unset";
    };
  }, [isOpen]);

  async function handleSave() {
    setLoading(true);
    setMessage("");
    try {
      if (name !== user.fullName) await updateFullName(user.email, name);
      if (avatar !== user.profilePictureUrl) await updateAvatar(user.email, avatar);
      setMessage("Success: Profile updated!");
      setTimeout(onClose, 1500);
    } catch (err) {
      setMessage("Failed to update profile.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    setLoading(true);
    try {
      await sendReset(user.email);
      setMessage("Success: Reset link sent!");
    } catch (err) {
      setMessage("Failed to send reset link.");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-6" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] rounded-t-[40px] sm:rounded-[40px] bg-surfaceContainerLow p-8 shadow-2xl border-t sm:border border-outlineVariant/10 max-h-[90vh] flex flex-col relative"
      >
        {/* Handle for mobile */}
        <div className="sm:hidden absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-onSurfaceVariant/20 rounded-full" />

        <div className="flex items-center justify-between mb-8 mt-2">
          <h3 className="text-2xl font-black text-onSurface tracking-tight">Edit Profile</h3>
          <button onClick={onClose} className="h-10 w-10 rounded-full bg-surfaceContainerHighest flex items-center justify-center text-onSurface active:scale-90 transition-transform">
            <ArrowLeft size={20} />
          </button>
        </div>

        <div className="space-y-8 overflow-y-auto pr-1 custom-scrollbar flex-1 pb-4">
          {/* Avatar Display Section */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-32 w-32 rounded-full overflow-hidden ring-4 ring-primary/20 transition-transform shadow-2xl">
              <ProfileAvatar name={name} avatarId={avatar} size={128} />
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-onSurfaceVariant uppercase tracking-[0.2em]">Profile Avatar</p>
              <p className="text-[10px] text-onSurfaceVariant/60 mt-1">Select a preset below to change</p>
            </div>
          </div>

          {/* Name Field */}
          <div className="space-y-3">
            <label className="text-[10px] font-black tracking-[0.2em] text-onSurfaceVariant uppercase ml-1">Full Name</label>
            <div className="relative group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-primary">
                <User size={20} />
              </div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-surfaceContainerLowest border border-outlineVariant/10 rounded-[24px] py-5 pl-14 pr-6 font-bold text-base text-onSurface outline-none focus:border-primary/40 focus:bg-surfaceContainerLow transition-all"
              />
            </div>
          </div>

          {/* Presets Grid */}
          <div className="space-y-4 pt-4 border-t border-outlineVariant/10">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-black tracking-[0.2em] text-onSurfaceVariant uppercase">Or use an avatar</label>
              <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase">Presets</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {avatarPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setAvatar(preset.id)}
                  className={cn(
                    "relative aspect-square rounded-2xl flex items-center justify-center transition-all active:scale-90",
                    avatar === preset.id
                      ? "bg-primary shadow-[0_8px_20px_rgba(0,93,167,0.3)] scale-105 z-10"
                      : "bg-surfaceContainerLowest border border-outlineVariant/10 hover:border-outlineVariant/20"
                  )}
                >
                  <ProfileAvatar name={preset.label} avatarId={preset.id} size={40} />
                  {avatar === preset.id && (
                    <div className="absolute -top-1 -right-1 bg-white rounded-full p-1 text-primary shadow-lg ring-2 ring-primary">
                      <Check size={10} strokeWidth={4} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Security Actions */}
          <div className="pt-6 border-t border-outlineVariant/10">
            <button
              onClick={handleResetPassword}
              disabled={loading}
              className="group w-full bg-red-500/5 rounded-[24px] p-5 border border-red-500/10 flex items-center justify-between transition-all active:scale-[0.98] hover:bg-red-500/10"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <Key size={18} className="text-red-500" />
                </div>
                <div className="text-left">
                  <span className="block font-bold text-sm text-onSurface">Reset Password</span>
                  <span className="block text-[10px] text-red-500/60 font-medium">Send secure link to email</span>
                </div>
              </div>
              <ArrowRight size={18} className="text-red-500/40 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 shrink-0">
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full rounded-[24px] bg-primary py-5 font-black text-sm text-white transition active:scale-95 flex items-center justify-center gap-3 shadow-[0_12px_24px_rgba(0,93,167,0.3)] disabled:opacity-50 disabled:grayscale"
          >
            {loading ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
            {loading ? "Saving Changes..." : "Apply Changes"}
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-[24px] bg-surfaceContainerHighest py-4 font-bold text-sm text-onSurface transition active:scale-95"
          >
            Go Back
          </button>
        </div>

        {message && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-xs font-black shadow-2xl z-20 whitespace-nowrap border",
              message.includes("Success")
                ? "bg-green-500 text-white border-green-400"
                : "bg-red-500 text-white border-red-400"
            )}
          >
            {message}
          </motion.div>
        )}
      </motion.div>
    </div>,
    document.body
  );
}

function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-outlineVariant/50", className)} />;
}

function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        "relative h-7 w-12 rounded-full transition-colors duration-200",
        checked ? "bg-primary" : "bg-surfaceContainerHigh"
      )}
    >
      <motion.div
        animate={{ x: checked ? 24 : 4 }}
        initial={false}
        className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

function SettingsRow({ icon: Icon, title, right, destructive, onClick }: { icon: LucideIcon; title: string; right?: React.ReactNode; destructive?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[64px] w-full items-center px-6 py-2 text-left">
      <Icon size={22} className={destructive ? "text-red-500" : "text-onSurfaceVariant"} />
      <span className={cn("ml-4 flex-1 text-lg font-medium", destructive && "text-red-500")}>{title}</span>
      {right ?? (!destructive ? <ChevronRight className="text-onSurfaceVariant" /> : null)}
    </button>
  );
}

export function TaskCompletedScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { userData, loading } = useProtectedUser();
  const tasks = useTasks();
  const taskId = params.get("taskId") ?? undefined;
  const isBonus = params.get("bonus") === "1";
  const hasProof = params.get("proof") === "1";
  const task = tasks.data.find((item) => item.id === taskId);

  const tx = useMemo(() => {
    if (!userData?.transactions || !taskId) return null;
    return [...userData.transactions].reverse().find(t =>
      t.taskId === taskId &&
      Boolean(t.isBonus) === isBonus
    );
  }, [userData?.transactions, taskId, isBonus]);

  const isLate = !isBonus && task && parseDate(task.dueDate).getTime() < Date.now();
  const credits = isLate
    ? Math.round((task?.credits ?? 0) / 2)
    : (isBonus ? task?.bonusCredits ?? 0 : task?.credits ?? Number(params.get("credits") ?? 0));

  const title = isBonus ? "Bonus Task" : task?.title ?? params.get("taskName") ?? "Task";
  const [showConfetti, setShowConfetti] = useState(true);

  React.useEffect(() => {
    // If we came here without proof flag (legacy or direct URL), try to mark completed
    // but the new flow handles it in the modal before redirecting.
    if (!hasProof && userData && task) {
       markTaskCompleted(userData, task, isBonus).catch(() => undefined);
    }
  }, [userData, task, isBonus, hasProof]);

  React.useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (loading || !userData) return <LoadingScreen />;

  return (
    <Screen>
      {showConfetti && <ConfettiCelebration />}
      <SafeArea className="flex min-h-screen flex-col justify-center py-10 text-center">
        {/* Animated checkmark with celebration rings */}
        <motion.div
          className="relative mx-auto flex h-[140px] w-[140px] items-center justify-center"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
        >
          <CelebrationRings />
          <motion.div
            className="relative flex h-[120px] w-[120px] items-center justify-center rounded-full bg-tertiaryContainer/20 shadow-[0_0_60px_rgba(185,244,116,0.35)]"
            animate={{
              boxShadow: [
                "0 0 40px rgba(185,244,116,0.25)",
                "0 0 80px rgba(185,244,116,0.4)",
                "0 0 40px rgba(185,244,116,0.25)",
              ],
            }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.3, 1] }}
              transition={{ duration: 0.6, delay: 0.5, ease: [0.2, 0, 0, 1] }}
            >
              <CheckCircle size={64} className="text-onTertiaryContainer" />
            </motion.div>
          </motion.div>
          <FloatingSparkles count={16} />
        </motion.div>

        {/* Animated title */}
        <motion.h1
          className="mt-12 text-[44px] font-black leading-tight"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7, ease: [0.2, 0, 0, 1] }}
        >
          Task Submitted!
        </motion.h1>

        <motion.p
          className="mt-4 text-base leading-relaxed text-onSurfaceVariant"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9, ease: [0.2, 0, 0, 1] }}
        >
          Your work for &quot;{title}&quot; has been sent for review. Hang tight while an admin checks it out!
        </motion.p>

        {/* Credits card with glow */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 1.1, ease: [0.2, 0, 0, 1] }}
        >
          <GhostCard className="mx-auto mt-12 w-full max-w-xs bg-surfaceContainerLow p-6">
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.6, delay: 1.5 }}
            >
              <Award size={32} className="mx-auto text-orange-500" />
            </motion.div>
            <div className="mt-3 text-[28px] font-bold text-primary credits-glow">
              +<AnimatedCounter value={credits} duration={1.5} /> Credits
            </div>
            <motion.div
              className="text-xs font-black tracking-[0.2em] text-onSurfaceVariant flex flex-col gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8 }}
            >
              {isLate && <span className="text-red-500">LATE SUBMISSION PENALTY APPLIED</span>}
              <span>PENDING REVIEW</span>
            </motion.div>
          </GhostCard>
        </motion.div>

        {tx && tx.proofUrls && tx.proofUrls.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.3 }}
            className="mx-auto mt-12 w-full max-w-sm px-4"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="h-[1px] flex-1 bg-outlineVariant/20" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-onSurfaceVariant/60 whitespace-nowrap">Submitted Evidence</span>
              <span className="h-[1px] flex-1 bg-outlineVariant/20" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {tx.proofUrls.map((url, i) => (
                <FilePreviewItem
                  key={i}
                  url={url}
                  name={tx.proofNames?.[i]}
                  isBonus={isBonus}
                />
              ))}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.5, ease: [0.2, 0, 0, 1] }}
        >
          <AppButton className="mt-16" onClick={() => router.push("/dashboard")}>Return to Home</AppButton>
        </motion.div>
      </SafeArea>
    </Screen>
  );
}

export function TaskSubmitScreen({ taskId }: { taskId?: string }) {
  const { userData, loading } = useProtectedUser();
  const tasks = useTasks();
  if (loading || !userData) return <LoadingScreen />;
  const task = tasks.data.find((item) => item.id === decodeURIComponent(taskId ?? ""));
  if (!task) return <Screen><SafeArea><BackHeader title="Task" /><p className="mt-10 text-center text-onSurfaceVariant">Task not found.</p></SafeArea></Screen>;
  return (
    <Screen>
      <SafeArea>
        <BackHeader title={task.phase} />
        <SimpleTaskCard task={task} user={userData} />
      </SafeArea>
    </Screen>
  );
}

export function AdminLoginScreen() {
  const router = useRouter();
  const auth = useCurrentUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Auto-redirect if already logged in
  useEffect(() => {
    if (!auth.loading && auth.userData) {
      if (auth.userData.role === "Admin") {
        router.replace("/admin/dashboard");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [auth.loading, auth.userData, router]);

  async function handleResetPassword() {
    if (!email.trim()) {
      setMessage("Please enter your admin email first.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await sendReset(email.trim());
      setMessage("A password reset link has been sent to your email.");
    } catch (error: any) {
      setMessage(error.message || "Could not send reset link.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    setLoading(true);
    setMessage("");
    try {
      await loginUser(email.trim(), password);
      router.push("/admin/dashboard");
    } catch {
      setMessage("Invalid credentials.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Screen>
      <SafeArea className="pt-0">
        <BackHeader />
        <h1 className="mt-4 text-[44px] font-bold leading-tight">Supervisor Access</h1>
        <p className="mt-3 text-base text-onSurfaceVariant">
          Enter your credentials to manage the cohort.
        </p>

        <div className="mt-12 space-y-6">
          <TextField label="ADMIN EMAIL" hint="admin@distilled.com" icon={Mail} value={email} onChange={setEmail} />
          <TextField label="PASSWORD" hint="Enter admin password" icon={Lock} type="password" value={password} onChange={setPassword} />
          <div className="flex justify-end px-2">
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={loading}
              className="text-sm font-bold text-primary active:opacity-60"
            >
              Forgot Password?
            </button>
          </div>
        </div>
        <FormError message={message} />
        <AppButton className="mt-12" disabled={loading} onClick={handleLogin}>{loading ? "Authenticating..." : "Login to Management"}</AppButton>
        <button
          type="button"
          disabled={loading || auth.loading}
          onClick={async () => {
            setLoading(true);
            try {
              await loginWithGoogle();
              // The useCurrentUser effect will handle redirection
            } catch (err: any) {
              setMessage(err.message || "Google login failed.");
            } finally {
              setLoading(false);
            }
          }}
          className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl border border-outlineVariant/30 bg-surfaceContainerLowest font-semibold"
        >
          <Chrome size={24} className="mr-3" /> Continue with Google
        </button>
      </SafeArea>
    </Screen>
  );
}

export function AdminDashboardScreen() {
  const router = useRouter();
  const auth = useProtectedAdmin();
  const users = useUsers();
  const notifications = useNotifications(auth.userData?.email);
  if (auth.loading || !auth.userData || auth.userData.role !== "Admin") return <LoadingScreen />;
  const interns = users.data.filter((user) => user.role !== "Admin");
  const pending = interns.flatMap((intern) => intern.transactions.filter((tx) => tx.status === "pending").map((tx) => ({ intern, tx }))).sort((a, b) => parseDate(b.tx.date).getTime() - parseDate(a.tx.date).getTime());
  const unreadCount = notifications.data.filter(n => !n.isRead).length;

  return (
    <Screen>
      <SafeArea bottomNav>
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-primary">Management Hub</p>
            <h1 className="mt-1 text-2xl font-semibold">Cohort Overview</h1>
          </div>
          <button
            type="button"
            onClick={() => router.push("/notifications")}
            className="apk-ghost relative rounded-full p-3"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-surfaceContainerLow" />
            )}
          </button>
        </header>
        <div className="mt-8 grid grid-cols-2 gap-4">
          <AdminMetric title="Pending Reviews" value={`${pending.length}`} accent onClick={() => router.push("/admin/submissions")} />
          <AdminMetric title="Total Interns" value={`${interns.length}`} onClick={() => router.push("/admin/leaderboard")} />
        </div>
        <div className="mt-10 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Needs Attention</h2>
          {pending.length > 3 ? <button type="button" onClick={() => router.push("/admin/submissions")} className="font-bold text-primary">View All</button> : null}
        </div>
        <div className="mt-4 space-y-4">
          {pending.length === 0 ? (
            <div className="py-10 text-center text-onSurfaceVariant"><CheckCircle size={48} className="mx-auto text-primary/20" /><p className="mt-4">All caught up!</p></div>
          ) : pending.slice(0, 5).map(({ intern, tx }) => (
            <GhostCard key={`${intern.email}-${tx.id}`} className="p-4" onClick={() => router.push(`/admin/intern/${encodeURIComponent(intern.email)}`)}>
              <div className="flex items-center">
                <ProfileAvatar name={intern.fullName} avatarId={intern.profilePictureUrl} size={44} borderWidth={2} borderColor="rgba(0,93,167,0.2)" />
                <span className="ml-4 min-w-0 flex-1">
                  <span className="flex items-center justify-between">
                    <span className="truncate font-bold">{intern.fullName}</span>
                    <span className="ml-2 text-[10px] text-onSurfaceVariant">{formatRelative(tx.date)}</span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-onSurfaceVariant">Requested {tx.amount} for: {tx.title}</span>
                </span>
                <ChevronRight size={16} className="ml-2 text-onSurfaceVariant/50" />
              </div>
            </GhostCard>
          ))}
        </div>
      </SafeArea>
    </Screen>
  );
}

function AdminMetric({ title, value, accent, onClick }: { title: string; value: string; accent?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("apk-ghost rounded-[32px] p-6 text-left transition-all active:scale-[0.98]", accent ? "bg-primary/10 border-primary/20" : "bg-surfaceContainerLow border-outlineVariant/5")}>
      <span className="text-xs font-black tracking-widest text-onSurfaceVariant/60 uppercase">{title}</span>
      <span className={cn("mt-2 block text-[36px] font-black leading-none tracking-tight", accent ? "text-primary" : "text-onSurface")}>{value}</span>
    </button>
  );
}

export function InternDirectoryScreen() {
  const router = useRouter();
  const auth = useProtectedAdmin();
  const users = useUsers();
  const [search, setSearch] = useState("");
  if (auth.loading || !auth.userData || auth.userData.role !== "Admin") return <LoadingScreen />;
  const interns = users.data.filter((user) => user.role !== "Admin" && user.fullName.toLowerCase().includes(search.toLowerCase()));
  return (
    <Screen>
      <SafeArea bottomNav>
        <h1 className="text-[44px] font-bold leading-none">Intern Directory</h1>
        <div className="relative mt-6">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-onSurfaceVariant" />
          <input className="h-14 w-full rounded-full border border-outlineVariant/15 bg-surfaceContainerLowest pl-12 pr-4 outline-none" placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="mt-6 space-y-3">
          {interns.length === 0 ? <p className="py-20 text-center text-onSurfaceVariant">No interns found</p> : interns.map((intern) => (
            <GhostCard key={intern.email} className="p-4" onClick={() => router.push(`/admin/intern/${encodeURIComponent(intern.email)}`)}>
              <div className="flex items-center">
                <ProfileAvatar name={intern.fullName} avatarId={intern.profilePictureUrl} size={48} borderWidth={2} borderColor="rgba(0,93,167,0.1)" />
                <span className="ml-4 flex-1">
                  <span className="block font-bold">{intern.fullName}</span>
                  <span className="text-xs text-onSurfaceVariant">{intern.role}</span>
                </span>
                <span className="text-right">
                  <span className="block font-extrabold text-primary">{intern.credits}</span>
                  <span className="text-[10px] text-onSurfaceVariant">Credits</span>
                </span>
              </div>
            </GhostCard>
          ))}
        </div>
      </SafeArea>
    </Screen>
  );
}

export function AdminLeaderboardScreen() {
  const router = useRouter();
  const auth = useProtectedAdmin();
  const users = useUsers();
  if (auth.loading || !auth.userData || auth.userData.role !== "Admin") return <LoadingScreen />;
  const interns = users.data.filter((user) => user.role !== "Admin").sort((a, b) => b.credits - a.credits);
  return (
    <Screen>
      <SafeArea bottomNav>
        <h1 className="text-[44px] font-bold leading-tight">Cohort Rankings</h1>
        <p className="mt-3 text-sm text-onSurfaceVariant">Global overview of intern performance.</p>
        <div className="mt-8 space-y-3">
          {interns.map((intern, index) => (
            <GhostCard key={intern.email} className="p-4" onClick={() => router.push(`/admin/intern/${encodeURIComponent(intern.email)}`)}>
              <div className="flex items-center">
                <span className="w-8 text-sm font-bold text-onSurfaceVariant">#{index + 1}</span>
                <ProfileAvatar name={intern.fullName} avatarId={intern.profilePictureUrl} size={36} borderWidth={2} borderColor="rgba(0,93,167,0.1)" />
                <span className="ml-3 flex-1 truncate font-semibold">{intern.fullName}</span>
                <span className="w-[72px] text-right">
                  <span className="block text-sm font-extrabold">{intern.credits.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-onSecondaryContainer">+0%</span>
                </span>
                <ChevronRight size={16} className="ml-2 text-onSurfaceVariant/50" />
              </div>
            </GhostCard>
          ))}
        </div>
      </SafeArea>
    </Screen>
  );
}

export function InternDetailScreen({ internId }: { internId?: string }) {
  const router = useRouter();
  const auth = useProtectedAdmin();
  const users = useUsers();
  const tasks = useTasks();

  if (auth.loading || !auth.userData || auth.userData.role !== "Admin") return <LoadingScreen />;

  const intern = users.data.find((user) => user.email === decodeURIComponent(internId ?? ""));

  if (!intern && users.loading) return <LoadingScreen />;
  if (!intern) return <Screen><SafeArea><BackHeader /><p className="mt-20 text-center text-onSurfaceVariant">Intern not found</p></SafeArea></Screen>;

  const pending = intern.transactions.filter((tx) => tx.status === "pending");
  const internTasks = tasks.data.filter(t => !t.assignedUserEmails.length || t.assignedUserEmails.includes(intern.email));
  const completedCount = internTasks.filter(t => completedForUser(t, intern)).length;

  return (
    <Screen>
      <SafeArea className="pt-0">
        <div className="flex h-14 items-center justify-between">
          <BackHeader />
          <MoreVertical />
        </div>
        <div className="mt-4 text-center">
          <ProfileAvatar name={intern.fullName} avatarId={intern.profilePictureUrl} size={96} borderWidth={2} borderColor="rgba(0,93,167,0.1)" />
          <div className="mt-4 inline-flex rounded-full bg-tertiaryContainer px-3 py-1 text-[10px] font-bold text-onTertiaryContainer">ON TRACK</div>
          <h1 className="mt-3 text-3xl font-bold">{intern.fullName}</h1>
          <p className="mt-1 text-sm text-onSurfaceVariant">{intern.role}</p>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-4">
          <DetailMetric title="Total Credits Earned" value={intern.credits.toLocaleString()} icon={Award} />
          <DetailMetric
            title="Tasks Completed"
            value={`${completedCount}/${internTasks.length}`}
            icon={CheckCircle}
            success
            onClick={() => {
              const el = document.getElementById('task-history');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </div>

        <h2 className="mt-10 text-2xl font-semibold">Pending Review</h2>
        <div className="mt-4 space-y-4">
          {pending.length === 0 ? (
            <p className="py-8 text-center text-onSurfaceVariant text-sm">No pending submissions.</p>
          ) : (
            pending.map((tx) => (
              <ReviewItem
                key={tx.id}
                user={intern}
                tx={tx}
                adminName={auth.userData?.fullName ?? "Admin"}
                hideUser
              />
            ))
          )}
        </div>

        <div id="task-history">
          <h2 className="mt-12 text-2xl font-semibold">Task History</h2>
          <p className="mt-1 text-sm text-onSurfaceVariant mb-6">Detailed view of requirements and completion status.</p>

          <div className="space-y-3 pb-20">
            {internTasks.length === 0 ? (
              <p className="py-10 text-center text-onSurfaceVariant text-sm">No tasks assigned to this intern.</p>
            ) : (
              internTasks.map((task) => {
                const isDone = completedForUser(task, intern);
                const submissionDate = intern.completedTaskDates?.[task.id];

                return (
                  <GhostCard key={task.id} className={cn("p-4 border transition-all", isDone ? "border-primary/20 bg-primary/5" : "border-outlineVariant/10")}>
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl",
                        isDone ? "bg-primary text-white" : "bg-surfaceContainerHigh text-onSurfaceVariant/40"
                      )}>
                        {isDone ? <CheckCircle size={20} /> : <Circle size={20} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={cn("block font-bold truncate", isDone ? "text-onSurface" : "text-onSurface/60")}>
                            {task.title}
                          </span>
                          <span className="text-[10px] font-black text-primary uppercase ml-2 shrink-0">{task.credits} PTS</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[10px] font-bold bg-surfaceContainerHighest px-2 py-0.5 rounded text-onSurfaceVariant uppercase tracking-wider">
                            {task.phase}
                          </span>
                          {isDone && submissionDate && (
                            <span className="text-[10px] text-green-600 font-bold">
                              Done {formatShortDate(submissionDate)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </GhostCard>
                );
              })
            )}
          </div>
        </div>
      </SafeArea>
    </Screen>
  );
}

function DetailMetric({ title, value, icon: Icon, success, onClick }: { title: string; value: string; icon: LucideIcon; success?: boolean; onClick?: () => void }) {
  return (
    <GhostCard className="p-5" onClick={onClick}>
      <span className={cn("inline-flex rounded-full p-2", success ? "bg-secondaryContainer text-onSecondaryContainer" : "bg-primary/10 text-primary")}><Icon size={16} /></span>
      <span className="mt-4 block text-3xl font-extrabold">{value}</span>
      <span className="mt-1 block text-[10px] text-onSurfaceVariant">{title}</span>
    </GhostCard>
  );
}

export function SubmissionsReviewScreen() {
  const { userData, loading } = useProtectedAdmin();
  const users = useUsers();
  if (loading || !userData || userData.role !== "Admin") return <LoadingScreen />;
  const pending = users.data.flatMap((user) => user.transactions.filter((tx) => tx.status === "pending").map((tx) => ({ user, tx })));
  const today = new Date();
  const approvedToday = users.data.flatMap((user) => user.transactions).filter((tx) => {
    const date = parseDate(tx.date);
    return tx.status === "approved" && date.toDateString() === today.toDateString();
  }).length;

  return (
    <Screen>
      <SafeArea className="pt-0">
        <BackHeader title="Review Center" center />
        <div className="mt-4 grid grid-cols-2 gap-4">
          <AdminMetric title="PENDING REVIEW" value={`${pending.length}`} accent onClick={() => undefined} />
          <AdminMetric title="APPROVED TODAY" value={`${approvedToday}`} onClick={() => undefined} />
        </div>
        <h2 className="mt-8 text-xs font-semibold tracking-[0.12em] text-onSurfaceVariant">AWAITING ACTION</h2>
        <div className="mt-4 space-y-4">
          {pending.length === 0 ? <p className="py-10 text-center text-onSurfaceVariant">All caught up! No pending submissions.</p> : pending.map(({ user, tx }) => <ReviewItem key={`${user.email}-${tx.id}`} user={user} tx={tx} adminName={userData?.fullName ?? "Admin"} />)}
        </div>
      </SafeArea>
    </Screen>
  );
}

function ReviewModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  actionLabel,
  isDestructive = false,
  requestedCredits,
  showCreditMeter = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (remarks: string, awardCredits?: number) => void;
  title: string;
  actionLabel: string;
  isDestructive?: boolean;
  requestedCredits?: number;
  showCreditMeter?: boolean;
}) {
  const maxCredits = Math.max(1, Math.round(Number(requestedCredits) || 1));
  const [remarks, setRemarks] = useState("");
  const [awardCredits, setAwardCredits] = useState(maxCredits);
  const [mounted, setMounted] = useState(false);

  useModalHistory(isOpen, onClose, "review");

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "unset";
      document.body.style.touchAction = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
      document.body.style.touchAction = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setRemarks("");
      setAwardCredits(maxCredits);
    }
  }, [isOpen, maxCredits]);

  if (!isOpen || !mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-end justify-center sm:items-center bg-black/70 backdrop-blur-md p-4" onClick={onClose}>
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[40px] bg-surfaceContainerLow p-8 shadow-2xl border border-white/5 mb-safe sm:mb-0"
      >
        <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-outlineVariant/30 sm:hidden" />
        <h3 className="text-3xl font-black text-center">{title}</h3>
        <p className="mt-4 text-onSurfaceVariant font-medium text-center text-lg leading-relaxed">
          {showCreditMeter ? "Choose the credits to award, then add an optional remark." : "Add an optional remark for the intern to see."}
        </p>

        {showCreditMeter ? (
          <CreditAwardMeter value={awardCredits} max={maxCredits} onChange={setAwardCredits} />
        ) : null}

        <div className="mt-8">
          <TextField
            label="ADMIN REMARKS"
            hint="Add feedback or notes..."
            value={remarks}
            onChange={setRemarks}
            multiline
          />
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-[24px] bg-surfaceContainerHigh py-5 font-black text-lg transition active:scale-95 order-2 sm:order-1"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(remarks, showCreditMeter ? awardCredits : undefined)}
            className={cn(
              "flex-1 rounded-[24px] py-5 font-black text-lg text-white transition active:scale-95 shadow-xl order-1 sm:order-2",
              isDestructive ? "bg-red-500 shadow-red-500/30" : "bg-primary shadow-primary/30"
            )}
          >
            {actionLabel}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

function clampCreditAward(value: number, maxCredits: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(Math.round(value), 1), maxCredits);
}

function CreditAwardMeter({ value, max, onChange }: { value: number; max: number; onChange: (value: number) => void }) {
  const progress = max <= 1 ? 100 : ((value - 1) / (max - 1)) * 100;
  const safeProgress = Math.min(Math.max(progress, 0), 100);
  const rangeBackground = `linear-gradient(90deg, var(--primary) 0%, #28D5C4 ${safeProgress * 0.58}%, #B9F474 ${safeProgress}%, var(--surface-container-highest) ${safeProgress}%, var(--surface-container-highest) 100%)`;

  return (
    <div className="mt-8 overflow-hidden rounded-[28px] border border-primary/15 bg-primary/5 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_10px_24px_rgba(0,163,255,0.28)]">
            <Zap size={20} fill="currentColor" />
          </span>
          <span>
            <span className="block text-[10px] font-black uppercase tracking-widest text-primary/80">Credit Award</span>
            <span className="block text-sm font-semibold text-onSurfaceVariant">Max {max} credits</span>
          </span>
        </div>
        <div className="text-right">
          <span className="block text-4xl font-black leading-none text-onSurface">{value}</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-onSurfaceVariant">credits</span>
        </div>
      </div>

      <div className="mt-6">
        <input
          aria-label="Credits to award"
          type="range"
          min={1}
          max={max}
          step={1}
          value={value}
          onChange={(event) => onChange(clampCreditAward(Number(event.target.value), max))}
          className="credit-award-range w-full"
          style={{ background: rangeBackground }}
        />
        <div className="mt-4 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-onSurfaceVariant/70">
          <span>1</span>
          <span className="flex items-center gap-1 text-primary"><Sparkles size={12} /> {Math.round(safeProgress)}%</span>
          <span>{max}</span>
        </div>
      </div>

      <label className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-surfaceContainerLowest/80 px-4 py-3 border border-outlineVariant/10">
        <span className="text-xs font-black uppercase tracking-widest text-onSurfaceVariant">Exact credits</span>
        <input
          aria-label="Exact credits"
          type="number"
          min={1}
          max={max}
          value={value}
          onChange={(event) => onChange(clampCreditAward(Number(event.target.value), max))}
          className="w-24 bg-transparent text-right text-xl font-black text-primary outline-none"
        />
      </label>
    </div>
  );
}

function ReviewItem({ user, tx, adminName, hideUser = false }: { user: UserModel; tx: VaultTransaction; adminName: string; hideUser?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"approve" | "reject" | null>(null);

  async function handleConfirm(remarks: string, awardCredits?: number) {
    const isApprove = modalMode === "approve";
    setModalMode(null);
    setBusy(true);
    setError(null);
    try {
      if (isApprove) await approveTransaction(user, tx, remarks, adminName, awardCredits);
      else await rejectTransaction(user, tx, remarks, adminName);
    } catch (err) {
      console.error("Review action failed:", err);
      setError(err instanceof Error ? err.message : "Action failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <GhostCard className="p-5">
      {!hideUser ? (
        <button type="button" onClick={() => router.push(`/admin/intern/${encodeURIComponent(user.email)}`)} className="flex w-full items-center text-left">
          <ProfileAvatar name={user.fullName} avatarId={user.profilePictureUrl} size={40} borderWidth={2} borderColor="rgba(0,93,167,0.1)" />
          <span className="ml-4 min-w-0 flex-1">
            <span className="block font-bold">{user.fullName}</span>
            <span className="block truncate text-xs text-onSurfaceVariant">{tx.title}</span>
          </span>
          <span className="text-lg font-black text-primary">+{tx.amount}</span>
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-[0.12em] text-primary">SUBMISSION</span>
            <span className="text-lg font-black text-primary">+{tx.amount}</span>
          </div>
          <h3 className="mt-3 text-lg font-semibold">{tx.title}</h3>
          <p className="mt-3 text-xs text-onSurfaceVariant"><Calendar size={16} className="mr-2 inline" /> {formatRelative(tx.date)}</p>
        </>
      )}

      {error && (
        <div className="mt-4 rounded-xl bg-red-500/10 p-3 text-xs font-semibold text-red-500 border border-red-500/20">
          {error}
        </div>
      )}

      {tx.proofUrls && tx.proofUrls.length > 0 && (
        <div className="mt-5 space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-onSurfaceVariant/60">Submitted Proof</span>
          <div className="flex flex-wrap gap-2">
            {tx.proofUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl bg-surfaceContainerHigh px-3 py-2 text-xs font-bold text-primary hover:bg-surfaceContainerHighest transition-colors border border-outlineVariant/10"
              >
                <Download size={14} />
                <span className="truncate max-w-[120px]">{tx.proofNames?.[i] || `File ${i + 1}`}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button type="button" disabled={busy} onClick={() => setModalMode("reject")} className="h-12 rounded-full border border-red-500/10 bg-red-500/10 font-semibold text-red-500 disabled:opacity-50">Reject</button>
        <button type="button" disabled={busy} onClick={() => setModalMode("approve")} className="h-12 rounded-full bg-primary font-semibold text-white shadow-[0_4px_12px_rgba(0,93,167,0.3)] disabled:opacity-50">
          {busy && modalMode === "approve" ? "Processing..." : "Approve"}
        </button>
      </div>

      <ReviewModal
        isOpen={modalMode !== null}
        onClose={() => setModalMode(null)}
        onConfirm={handleConfirm}
        title={modalMode === "approve" ? "Approve Credits?" : "Reject Credits?"}
        actionLabel={modalMode === "approve" ? "Approve" : "Reject"}
        isDestructive={modalMode === "reject"}
        requestedCredits={tx.amount}
        showCreditMeter={modalMode === "approve"}
      />
    </GhostCard>
  );
}

export function TaskManagementScreen() {
  const auth = useProtectedAdmin();
  const users = useUsers();
  const tasks = useTasks();
  const [editing, setEditing] = useState<TaskModel | null>(null);
  const [isForm, setForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  if (auth.loading || !auth.userData || auth.userData.role !== "Admin") return <LoadingScreen />;
  if (isForm) return <TaskForm initial={editing} users={users.data} onDone={() => { setEditing(null); setForm(false); }} />;
  return (
    <Screen>
      <SafeArea bottomNav className="relative">
        <h1 className="text-[44px] font-bold leading-tight">Task Management</h1>
        <p className="mt-3 text-sm text-onSurfaceVariant">Manage and monitor all intern assignments.</p>
        <div className="mt-6 space-y-4">
          {tasks.data.length === 0 ? <p className="py-20 text-center text-onSurfaceVariant">No tasks found. Create one!</p> : tasks.data.map((task) => (
            <GhostCard key={task.id} className="p-4">
              <div className="flex items-start justify-between">
                <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-primary">{task.taskType}</span>
                <span>
                  <button type="button" className="p-2 text-onSurfaceVariant" onClick={() => { setEditing(task); setForm(true); }}><Edit3 size={18} /></button>
                  <button type="button" className="p-2 text-red-400" onClick={() => setDeletingId(task.id)}><Trash2 size={18} /></button>
                </span>
              </div>
              <h2 className="mt-2 font-bold">{task.title}</h2>
              <p className="mt-1 line-clamp-2 text-xs text-onSurfaceVariant">{task.description}</p>
              <div className="mt-4 flex items-center text-[11px] text-onSurfaceVariant">
                <Calendar size={14} className="mr-1" /> Due {formatShortDate(task.dueDate)}
                <span className="ml-auto flex items-center font-black text-primary"><Award size={14} className="mr-1" /> {task.credits} Credits</span>
              </div>
            </GhostCard>
          ))}
        </div>
        <button type="button" onClick={() => { setEditing(null); setForm(true); }} className="fixed bottom-28 right-[calc(50%_-_208px)] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg">
          <Plus />
        </button>

        <ConfirmationModal
          isOpen={deletingId !== null}
          onClose={() => setDeletingId(null)}
          onConfirm={() => deletingId && deleteTask(deletingId)}
          title="Delete Task?"
          message="This action cannot be undone. All intern progress for this task will be lost."
          confirmLabel="Delete"
          isDestructive
          icon={Trash2}
        />
      </SafeArea>
    </Screen>
  );
}

function TaskForm({ initial, users, onDone }: { initial: TaskModel | null; users: UserModel[]; onDone: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [deadline, setDeadline] = useState(initial ? new Date(initial.dueDate).toISOString().slice(0, 16) : "");
  const [credits, setCredits] = useState(initial?.credits.toString() ?? "");
  const [taskType, setTaskType] = useState(initial?.taskType ?? "Main Task");
  const [assigned, setAssigned] = useState<string[]>(initial?.assignedUserEmails ?? []);
  const [bonus, setBonus] = useState(Boolean(initial?.bonusAvailable));
  const [bonusDescription, setBonusDescription] = useState(initial?.bonusDescription ?? "");
  const [bonusCredits, setBonusCredits] = useState(initial?.bonusCredits.toString() ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const interns = users.filter((user) => user.role !== "Admin");

  async function save() {
    if (!title || !description || !deadline || !credits) {
      setError("Please fill all required fields.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const baseCredits = Math.max(0, Number(credits));
      const bonusCreds = bonus ? Math.max(0, Number(bonusCredits || 0)) : 0;

      const task: TaskModel = {
        id: initial?.id ?? crypto.randomUUID(),
        title,
        description,
        phase: initial?.phase || "ADMIN ASSIGNED",
        taskType,
        dueDate: new Date(deadline).toISOString(),
        credits: baseCredits,
        bonusAvailable: bonus,
        bonusDescription: bonus ? bonusDescription : "",
        bonusCredits: bonusCreds,
        isCompleted: initial?.isCompleted ?? false,
        isBonusCompleted: initial?.isBonusCompleted ?? false,
        assignedUserEmails: assigned,
        submittedByUserEmails: initial?.submittedByUserEmails ?? [],
        submittedBonusByUserEmails: initial?.submittedBonusByUserEmails ?? [],
        completedByUserEmails: initial?.completedByUserEmails ?? [],
        completedBonusByUserEmails: initial?.completedBonusByUserEmails ?? [],
        submissionDate: initial?.submissionDate ?? null,
      };

      if (initial) await updateTask(task);
      else await addTask(task);
      onDone();
    } catch (err) {
      console.error("Task save failed:", err);
      setError("Failed to save task. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <SafeArea>
        <div className="flex items-center">
          <button type="button" onClick={onDone} className="mr-2 rounded-full p-2"><ArrowLeft /></button>
          <h1 className="text-3xl font-semibold">{initial ? "Edit Task" : "Create New Task"}</h1>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl bg-red-500/10 p-4 text-sm font-semibold text-red-500 border border-red-500/20">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-6">
          <TextField label="TASK TITLE" hint="e.g., Q3 Market Analysis Report" value={title} onChange={setTitle} />
          <TextField label="DESCRIPTION" hint="Outline the primary deliverables..." value={description} onChange={setDescription} multiline />
          <div>
            <span className="block text-[11px] font-semibold tracking-[0.12em] text-onSurfaceVariant">TASK CONFIGURATION</span>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <select className="h-14 rounded-xl border border-outlineVariant/15 bg-surfaceContainerLowest px-3 outline-none" value={taskType} onChange={(e) => setTaskType(e.target.value)}>
                <option>Main Task</option>
                <option>Daily Task</option>
              </select>
              <input type="datetime-local" className="h-14 rounded-xl border border-outlineVariant/15 bg-surfaceContainerLowest px-3 outline-none" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          <TextField label="BASE CREDITS" hint="e.g., 150" icon={Award} type="number" value={credits} onChange={(val) => setCredits(val.replace(/\D/g, ""))} />
          <div className="rounded-2xl border border-outlineVariant/15 bg-surfaceContainerLowest p-4">
            <div className="flex items-center gap-3">
              <Users className="text-onSurfaceVariant" />
              <span className="font-semibold">{assigned.length === 0 ? "Assign to all Interns (Global)" : `Assigned to ${assigned.length} Intern(s)`}</span>
            </div>
            <label className="mt-4 flex cursor-pointer items-center gap-3">
              <input type="checkbox" className="h-5 w-5 rounded accent-primary" checked={assigned.length === 0} onChange={() => setAssigned([])} />
              <span className="font-medium text-sm">Global (All Interns)</span>
            </label>
            <div className="mt-4 max-h-40 overflow-y-auto space-y-3 pr-2">
              {interns.map((user) => (
                <label key={user.email} className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 rounded accent-primary"
                    checked={assigned.includes(user.email)}
                    onChange={(e) => setAssigned((items) => e.target.checked ? [...items, user.email] : items.filter((email) => email !== user.email))}
                  />
                  <span><span className="block text-sm font-semibold">{user.fullName}</span><span className="text-[10px] text-onSurfaceVariant">{user.email}</span></span>
                </label>
              ))}
            </div>
          </div>
          {taskType === "Main Task" ? (
            <div className={cn("rounded-xl border p-4 transition-colors", bonus ? "border-amber-500/50 bg-amber-500/5" : "border-outlineVariant/15 bg-surfaceContainerLowest")}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-3 font-semibold text-sm"><Sparkles size={18} className={bonus ? "text-orange-500" : "text-onSurfaceVariant"} /> Include Side / Bonus Task</span>
                <Switch checked={bonus} onChange={() => setBonus(!bonus)} />
              </div>
              {bonus ? <div className="mt-4 space-y-4 border-t border-amber-500/10 pt-4"><TextField label="SIDE TASK DESCRIPTION" hint="e.g., Include a competitor sentiment analysis" value={bonusDescription} onChange={setBonusDescription} /><TextField label="BONUS CREDITS" hint="e.g., 50" icon={Award} type="number" value={bonusCredits} onChange={(val) => setBonusCredits(val.replace(/\D/g, ""))} /></div> : null}
            </div>
          ) : null}
          <AppButton disabled={loading} onClick={save}>{loading ? "Saving..." : (initial ? "Update Task" : "Create Task")}</AppButton>
        </div>
      </SafeArea>
    </Screen>
  );
}

export function ParamPhaseDetailScreen() {
  const params = useParams<{ name: string }>();
  return <PhaseDetailScreen phaseName={params.name} />;
}

export function ParamTaskSubmitScreen() {
  const params = useParams<{ id: string }>();
  return <TaskSubmitScreen taskId={params.id} />;
}

export function ParamInternDetailScreen() {
  const params = useParams<{ id: string }>();
  return <InternDetailScreen internId={params.id} />;
}
