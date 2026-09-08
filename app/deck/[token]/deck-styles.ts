/**
 * Deck stylesheet. Inlined to avoid being touched by global Tailwind purge or
 * layout inheritance; all styles are scoped under `.deck-root`.
 */
export const DECK_STYLES = `
  .deck-root {
    position: fixed;
    inset: 0;
    background: #09090b;
    display: flex;
    flex-direction: column;
    font-family: var(--font-sans, ui-sans-serif, system-ui, sans-serif);
    overflow: hidden;
    touch-action: pan-y;
  }
  .deck-viewport {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
  .deck-stage {
    position: absolute;
    inset: 0;
    display: flex;
    will-change: transform;
    transition: transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .deck-slide-wrapper {
    flex: 0 0 100%;
    width: 100%;
    height: 100%;
    overflow-y: auto;
  }
  .deck-slide {
    width: 100%;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    opacity: 0.4;
    transition: opacity 600ms ease;
  }
  .deck-slide-wrapper[data-active="true"] .deck-slide {
    opacity: 1;
  }
  .deck-stagger {
    opacity: 0;
    transform: translateY(16px);
  }
  .deck-slide-wrapper[data-active="true"] .deck-stagger {
    animation: deck-stagger-in 600ms cubic-bezier(0.22, 0.8, 0.2, 1) forwards;
    animation-delay: calc(var(--i, 0) * 70ms + 300ms);
  }
  @keyframes deck-stagger-in {
    to { opacity: 1; transform: translateY(0); }
  }

  /* Progress bar */
  .deck-progress {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: rgba(255,255,255,0.06);
    z-index: 60;
  }
  .deck-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #9CC196, #2A4227);
    transition: width 480ms cubic-bezier(0.22, 0.8, 0.2, 1);
  }

  /* Controls */
  .deck-controls {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 4px;
    background: rgba(15,15,18,0.7);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 999px;
    padding: 6px;
    z-index: 50;
    opacity: 1;
    transition: opacity 400ms ease;
  }
  .deck-controls[data-hidden="true"] {
    opacity: 0;
    pointer-events: none;
  }
  @keyframes deck-fade-in { to { opacity: 1; } }
  .deck-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: rgba(255,255,255,0.85);
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 8px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
    transition: background 150ms, color 150ms, transform 150ms;
  }
  .deck-btn:hover { background: rgba(255,255,255,0.08); color: white; }
  .deck-btn:active { transform: scale(0.94); }
  .deck-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .deck-btn-sep {
    width: 1px;
    height: 18px;
    background: rgba(255,255,255,0.1);
    margin: 0 2px;
  }
  .deck-counter {
    color: rgba(255,255,255,0.55);
    font-size: 11px;
    min-width: 38px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  /* Dot indicator */
  .deck-dots {
    position: fixed;
    top: 50%;
    right: 18px;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 50;
  }
  .deck-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: rgba(255,255,255,0.2);
    cursor: pointer;
    border: none;
    padding: 0;
    transition: background 150ms, transform 150ms;
  }
  .deck-dot:hover { background: rgba(255,255,255,0.5); transform: scale(1.4); }
  .deck-dot[data-active="true"] { background: #9CC196; transform: scale(1.6); }

  /* Grid overlay (rendered as native <dialog>) */
  dialog.deck-grid-overlay {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    max-width: none;
    max-height: none;
    margin: 0;
    border: none;
    color: inherit;
    background: rgba(9,9,11,0.92);
    backdrop-filter: blur(8px);
    z-index: 80;
    display: flex;
    flex-direction: column;
    padding: 48px;
    overflow-y: auto;
    animation: deck-fade-in 200ms ease-out forwards;
  }
  dialog.deck-grid-overlay::backdrop {
    background: transparent;
  }
  .deck-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
    width: 100%;
  }
  .deck-grid-card {
    position: relative;
    aspect-ratio: 16 / 10;
    border-radius: 12px;
    cursor: pointer;
    overflow: hidden;
    border: 2px solid transparent;
    transition: transform 150ms, border-color 150ms;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
    text-align: center;
    font-size: 13px;
    font-weight: 600;
    color: #18181b;
  }
  .deck-grid-card[data-accent="green"] { background: #2A4227; color: white; }
  .deck-grid-card[data-accent="zinc"]  { background: #f4f4f5; }
  .deck-grid-card:hover { transform: translateY(-2px); border-color: #9CC196; }
  .deck-grid-card[data-active="true"] { border-color: #9CC196; }
  .deck-grid-card-index {
    position: absolute;
    top: 8px; left: 10px;
    font-size: 10px;
    font-weight: 700;
    opacity: 0.5;
    letter-spacing: 0.08em;
  }

  /* Watermark */
  .deck-watermark {
    position: fixed;
    bottom: 60px;
    right: 40px;
    font-size: 11px;
    font-weight: 500;
    color: rgba(0,0,0,0.08);
    letter-spacing: 0.06em;
    pointer-events: none;
    user-select: none;
    white-space: nowrap;
    transform: rotate(-20deg);
    z-index: 5;
  }

  /* Arrow tooltip */
  .deck-tooltip {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(15,15,18,0.75);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 999px;
    padding: 8px 18px;
    font-size: 12px;
    color: rgba(255,255,255,0.65);
    z-index: 55;
    cursor: pointer;
    animation: deck-fade-in 400ms ease-out forwards, deck-tooltip-out 400ms ease-in 3s forwards;
  }
  @keyframes deck-tooltip-out { to { opacity: 0; pointer-events: none; } }

  /* Help overlay & shortcuts modal */
  .deck-overlay-help {
    position: fixed;
    inset: 0;
    background: rgba(9,9,11,0.88);
    backdrop-filter: blur(16px);
    z-index: 90;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: deck-fade-in 200ms ease-out forwards;
    cursor: pointer;
  }
  .deck-overlay-help-inner {
    background: rgba(24,24,27,0.95);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 36px 40px;
    min-width: 340px;
    cursor: default;
  }
  .deck-shortcut-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 6px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .deck-shortcut-row:last-of-type { border-bottom: none; }
  .deck-kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 84px;
    padding: 4px 10px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 6px;
    font-size: 11px;
    font-family: ui-monospace, monospace;
    color: rgba(255,255,255,0.7);
    white-space: nowrap;
  }
  .deck-shortcut-label {
    font-size: 13px;
    color: rgba(255,255,255,0.55);
  }

  /* Print */
  .print-all { display: none; }
  @media print {
    @page { size: landscape; margin: 0; }
    .deck-root { position: static; background: white; overflow: visible; }
    .deck-viewport, .no-print { display: none !important; }
    .print-all { display: block; }
    .print-slide { page-break-after: always; height: 100vh; display: flex; }
    .print-slide .deck-slide { flex: 1; }
    .deck-stagger { opacity: 1 !important; transform: none !important; animation: none !important; }
  }

  /* Responsive: tablet and below */
  @media (max-width: 768px) {
    .deck-watermark { bottom: 80px; right: 16px; font-size: 10px; }
    .deck-dots { right: 10px; gap: 6px; }
    .deck-dot { width: 5px; height: 5px; }
  }

  /* Responsive: mobile */
  @media (max-width: 640px) {
    .deck-controls {
      bottom: 12px;
      padding: 4px;
      gap: 0;
      max-width: calc(100vw - 24px);
    }
    .deck-btn { padding: 7px 8px; font-size: 11px; gap: 4px; }
    .deck-btn-label { display: none; }
    .deck-btn-sep { height: 14px; margin: 0; }
    .deck-counter { font-size: 10px; min-width: 30px; }
    .deck-dots { display: none; }
    .deck-watermark { bottom: 64px; right: 12px; font-size: 9px; }
    .deck-tooltip { bottom: 68px; font-size: 11px; padding: 6px 14px; }
    .deck-overlay-help-inner {
      min-width: 0;
      width: calc(100% - 32px);
      max-width: 400px;
      padding: 24px 20px;
      border-radius: 16px;
      max-height: calc(100vh - 64px);
      overflow-y: auto;
    }
    .deck-kbd { min-width: 64px; font-size: 10px; padding: 3px 8px; }
    .deck-shortcut-label { font-size: 12px; }
    .deck-shortcut-row { gap: 12px; padding: 5px 0; }
    dialog.deck-grid-overlay { padding: 20px 16px; }
    .deck-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
    .deck-grid-card { font-size: 11px; padding: 8px; }
  }
`
