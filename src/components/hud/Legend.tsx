const ITEMS = [
  { glyph: "◆", color: "var(--color-cost)", label: "Handshake", sub: "SYN · SYN-ACK · ACK" },
  { glyph: "■", color: "var(--color-cyan)", label: "Request", sub: "GET a file" },
  { glyph: "■", color: "var(--color-lime)", label: "Response", sub: "the file" },
  { glyph: "○", color: "var(--color-muted)", label: "Close", sub: "FIN" },
];

/** What the shapes in the world mean: shape + colour + words. */
export function Legend({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1.5 ${className}`} aria-label="What the packets mean">
      {ITEMS.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5 text-xs">
          <span aria-hidden="true" style={{ color: i.color }}>
            {i.glyph}
          </span>
          <span className="text-text">{i.label}</span>
          <span className="font-mono text-[0.68rem] text-faint">{i.sub}</span>
        </li>
      ))}
    </ul>
  );
}
