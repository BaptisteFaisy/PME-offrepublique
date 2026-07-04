type LogoProps = {
  /** Use the light variant on dark backgrounds (footer). */
  variant?: "dark" | "light";
};

export function Logo({ variant = "dark" }: LogoProps) {
  const wordColor = variant === "light" ? "text-white" : "text-slate-900";

  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm shadow-brand-600/30"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Stylised document with a validation check */}
          <path d="M7 3.5h6.5L18 8v10.5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
          <path d="m9 12 2 2 4-4.5" />
        </svg>
      </span>
      <span className={`text-lg font-bold tracking-tight ${wordColor}`}>
        Zephao
      </span>
    </span>
  );
}
