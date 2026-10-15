import type { CSSProperties, ReactNode } from "react";

interface FadeProps {
  delay: number;
  className?: string;
  children: ReactNode;
}

export default function Fade({ delay, className = "", children }: FadeProps) {
  return (
    <div
      className={`fade ${className}`.trim()}
      style={{ "--d": `${delay}s` } as CSSProperties}
    >
      {children}
    </div>
  );
}