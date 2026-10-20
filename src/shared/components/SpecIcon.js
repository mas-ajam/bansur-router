"use client";

/**
 * Artifact-spec icon: custom 24-viewBox stroke SVG (stroke 1.8, no fill),
 * rendered at 17×17 by default — replaces Material Symbols glyphs in the
 * shell and primitives aligned to the Bansur Router Dashboard artifact.
 * Pass the artifact's path/rect/circle elements as children.
 */
export default function SpecIcon({
  size = 17,
  strokeWidth = 1.8,
  className,
  style,
  children,
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      className={className}
      style={style}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}
