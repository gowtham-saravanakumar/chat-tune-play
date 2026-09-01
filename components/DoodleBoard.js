import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";

const COLORS = ["#1A73E8", "#188038", "#D93025", "#F9AB00", "#8430CE", "#202124"];

export default function DoodleBoard({ items, onAddItem, onClear }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [color, setColor] = useState(COLORS[0]);
  const [noteMode, setNoteMode] = useState(false);
  const drawingRef = useRef(false);
  const currentPointsRef = useRef([]);

  useEffect(() => {
    redraw();
  }, [items]);

  useEffect(() => {
    function handleResize() {
      redraw();
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [items]);

  function redraw() {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    canvas.width = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const item of items) {
      if (item.type === "stroke") drawStroke(ctx, item, canvas.width, canvas.height);
    }
  }

  function drawStroke(ctx, item, w, h) {
    if (item.points.length < 2) return;
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    item.points.forEach((p, i) => {
      const x = p.x * w;
      const y = p.y * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  function relativePoint(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  }

  function pointerDown(e) {
    if (noteMode) return;
    drawingRef.current = true;
    currentPointsRef.current = [relativePoint(e)];
  }

  function pointerMove(e) {
    if (!drawingRef.current || noteMode) return;
    const p = relativePoint(e);
    currentPointsRef.current.push(p);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pts = currentPointsRef.current;
    if (pts.length >= 2) {
      const a = pts[pts.length - 2];
      const b = pts[pts.length - 1];
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
      ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
      ctx.stroke();
    }
  }

  function pointerUp() {
    if (noteMode) return;
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const points = currentPointsRef.current;
    currentPointsRef.current = [];
    if (points.length < 2) return;
    const item = { id: nanoid(8), type: "stroke", points, color };
    onAddItem(item);
  }

  function canvasClick(e) {
    if (!noteMode) return;
    const p = relativePoint(e);
    const text = window.prompt("Leave a short note:");
    if (!text?.trim()) return;
    const item = { id: nanoid(8), type: "note", x: p.x, y: p.y, text: text.slice(0, 140), color };
    onAddItem(item);
    setNoteMode(false);
  }

  function clearAll() {
    onClear();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b border-border bg-elevated overflow-x-auto">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-label={`Choose color ${c}`}
            className={`w-6 h-6 rounded-full border-2 shrink-0 ${color === c ? "border-ptext" : "border-transparent"}`}
            style={{ backgroundColor: c }}
          />
        ))}
        <div className="w-px h-5 bg-border mx-1 shrink-0" />
        <button
          onClick={() => setNoteMode((v) => !v)}
          className={`text-xs font-medium rounded-lg px-3 py-1.5 border shrink-0 transition ${
            noteMode ? "bg-warmsoft border-warm text-warm" : "bg-card border-border text-muted hover:text-ptext"
          }`}
        >
          {noteMode ? "Tap board to place note" : "Add note"}
        </button>
        <button
          onClick={clearAll}
          className="text-xs font-medium rounded-lg px-3 py-1.5 border border-border bg-card text-muted hover:text-danger hover:border-danger transition shrink-0 ml-auto"
        >
          Clear board
        </button>
      </div>

      <div ref={wrapRef} className="relative flex-1 bg-app-gradient">
        <canvas
          ref={canvasRef}
          onMouseDown={pointerDown}
          onMouseMove={pointerMove}
          onMouseUp={pointerUp}
          onMouseLeave={pointerUp}
          onTouchStart={pointerDown}
          onTouchMove={pointerMove}
          onTouchEnd={pointerUp}
          onClick={canvasClick}
          className="absolute inset-0 w-full h-full touch-none"
        />
        {items
          .filter((i) => i.type === "note")
          .map((n) => (
            <div
              key={n.id}
              style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%`, borderColor: n.color }}
              className="absolute -translate-x-1/2 -translate-y-1/2 max-w-[160px] bg-elevated border rounded-xl px-3 py-2 text-xs shadow-lg pointer-events-none"
            >
              {n.text}
            </div>
          ))}
        {items.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted pointer-events-none px-8 text-center">
            Draw something or leave a note for them to find later.
          </p>
        )}
      </div>
    </div>
  );
}
