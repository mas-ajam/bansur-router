/**
 * Bansur Router mesh logo mark — ring + node constellation.
 * Geometry matches the approved design prototype (viewBox 0 0 96 96).
 * Renders in currentColor so it adapts to sidebar / login contexts.
 */
export default function LogoMark({ size = 36, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="48" cy="48" r="38" stroke="currentColor" strokeWidth="4" />
      <g stroke="currentColor" strokeWidth="2.2" opacity="0.5">
        <line x1="44" y1="50" x2="32" y2="34" />
        <line x1="44" y1="50" x2="52" y2="28" />
        <line x1="44" y1="50" x2="66" y2="42" />
        <line x1="44" y1="50" x2="64" y2="64" />
        <line x1="44" y1="50" x2="36" y2="64" />
        <line x1="52" y1="28" x2="66" y2="42" />
        <line x1="32" y1="34" x2="36" y2="64" />
      </g>
      <g fill="currentColor">
        <circle cx="32" cy="34" r="4.4" />
        <circle cx="52" cy="28" r="4.4" />
        <circle cx="66" cy="42" r="4.4" />
        <circle cx="44" cy="50" r="6" />
        <circle cx="64" cy="64" r="4.4" />
        <circle cx="36" cy="64" r="4.4" />
      </g>
    </svg>
  );
}
