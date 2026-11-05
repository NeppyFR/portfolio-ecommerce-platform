/** Project mark: three dots on a curved wire, made for black. Same drawing as src/app/icon.svg, which lays it on a black tile for light browser tabs. */
export function Mark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 22 22" width={size} height={size} className={className} aria-hidden="true">
      <path d="M3 15.5C7 6 15 6 19 15.5" fill="none" stroke="#2f6bff" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="3" cy="15.5" r="2.5" fill="#6fd3ff" />
      <circle cx="11" cy="8.4" r="2.5" fill="#2f6bff" />
      <circle cx="19" cy="15.5" r="2.5" fill="#8c7bff" />
    </svg>
  );
}
