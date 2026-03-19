interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export function Logo({ width = 32, height = 32, className }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 540 180"
      width={width}
      height={height}
      className={className}
      aria-label="RUN Logo"
    >
      {/* Speed lines - orange accent */}
      <polygon fill="#EA580C" points="0,38 52,38 52,48 0,48" opacity="0.8" />
      <polygon fill="#EA580C" points="6,82 72,82 72,92 6,92" opacity="0.55" />
      <polygon fill="#EA580C" points="0,128 38,128 38,138 0,138" opacity="0.7" />

      {/* RUN letters with italic skew for racing feel */}
      <g transform="translate(82,5) skewX(-12)">
        {/* R - left bar */}
        <polygon fill="currentColor" points="0,0 28,0 28,170 0,170" />
        {/* R - top bar */}
        <polygon fill="currentColor" points="28,0 105,0 105,28 28,28" />
        {/* R - right arm */}
        <polygon fill="currentColor" points="105,0 126,0 126,70 105,70" />
        {/* R - middle bar */}
        <polygon fill="currentColor" points="28,70 105,70 105,95 28,95" />
        {/* R - diagonal leg in orange accent */}
        <polygon fill="#EA580C" points="62,95 93,95 126,170 95,170" />

        {/* U - single polygon forming open-top U */}
        <polygon fill="currentColor" points="158,0 186,0 186,142 258,142 258,0 286,0 286,170 158,170" />

        {/* N - left bar */}
        <polygon fill="currentColor" points="318,0 346,0 346,170 318,170" />
        {/* N - diagonal */}
        <polygon fill="currentColor" points="346,0 374,0 446,135 446,170 418,170 346,35" />
        {/* N - right bar */}
        <polygon fill="currentColor" points="418,0 446,0 446,170 418,170" />
      </g>
    </svg>
  );
}
