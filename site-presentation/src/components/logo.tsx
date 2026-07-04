import Image from "next/image";

type LogoProps = {
  /** Use the light variant on dark backgrounds (footer). */
  variant?: "dark" | "light";
};

export function Logo({ variant = "dark" }: LogoProps) {
  const wordColor = variant === "light" ? "text-white" : "text-slate-900";

  return (
    <span className="inline-flex items-center gap-2.5">
      <Image
        src="/zephao-logo.png"
        alt=""
        width={32}
        height={32}
        priority
        className="h-8 w-8 rounded-lg shadow-sm shadow-brand-600/30"
      />
      <span className={`text-lg font-bold tracking-tight ${wordColor}`}>
        Zephao
      </span>
    </span>
  );
}
