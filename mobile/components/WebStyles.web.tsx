export function WebStyles() {
  return (
    <style>{`
    html { color-scheme: light; background: #FAF9F5; }
    html, body, #root { max-width: 100%; overflow-x: clip; }
    :focus-visible { outline: 3px solid #465A35 !important; outline-offset: 3px !important; }
    input:focus-visible, textarea:focus-visible { outline-offset: -2px !important; border-radius: 7px; }
    [role="button"], a { transition: background-color 140ms ease, box-shadow 140ms ease, opacity 140ms ease; }
    [role="button"]:not([aria-disabled="true"]):hover { box-shadow: inset 0 0 0 1000px rgba(70,90,53,.035); }
    ::selection { background: #DCE4CF; color: #282D25; }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
  `}</style>
  );
}
