import { useEffect, useRef } from "react";

/**
 * Modern flowing wave lines built from dotted particles with blur/depth.
 * Inspired by abstract energy-wave editorial art. Mouse gently distorts flow.
 */
export function MouseWaves() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
    let t = 0;
    let raf = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const onMove = (e: MouseEvent) => {
      mouse.tx = e.clientX;
      mouse.ty = e.clientY;
    };
    const onLeave = () => {
      mouse.tx = -9999;
      mouse.ty = -9999;
    };
    const onTouch = (e: TouchEvent) => {
      if (e.touches[0]) {
        mouse.tx = e.touches[0].clientX;
        mouse.ty = e.touches[0].clientY;
      }
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    window.addEventListener("touchmove", onTouch, { passive: true });

    const LINES = 26;         // number of stacked streams
    const DOT_STEP = 10;      // spacing between dots along each stream

    const draw = () => {
      t += 0.006;
      mouse.x += (mouse.tx - mouse.x) * 0.1;
      mouse.y += (mouse.ty - mouse.y) * 0.1;

      ctx.clearRect(0, 0, width, height);

      const overshoot = 160;
      const totalH = height + overshoot * 2;
      const spacing = totalH / (LINES - 1);
      const influence = 260;

      for (let i = 0; i < LINES; i++) {
        const baseY = -overshoot + i * spacing;
        const streamPhase = i * 0.18;
        // depth 0..1 across the stack — used for size/blur/opacity variation
        const depthCurve = Math.sin(i * 0.42 + t * 0.3) * 0.5 + 0.5;

        // per-line hue drift: indigo → magenta → cyan
        const hue = 250 + Math.sin(i * 0.22 + t * 0.4) * 60;

        for (let x = -DOT_STEP; x <= width + DOT_STEP; x += DOT_STEP) {
          const nx = x * 0.002;

          const flow =
            Math.sin(nx * 1.9 + t * 1.1 + streamPhase) * 34 +
            Math.sin(nx * 0.9 - t * 0.7 + streamPhase * 1.4) * 22 +
            Math.cos(nx * 0.4 + t * 0.5 + streamPhase * 0.6) * 14;

          // mouse push — soft radial displacement
          const dxm = x - mouse.x;
          const dym = baseY + flow - mouse.y;
          const dist = Math.sqrt(dxm * dxm + dym * dym);
          let push = 0;
          if (dist < influence) {
            const f = 1 - dist / influence;
            push = Math.sign(dym || 1) * f * f * 60;
          }

          const y = baseY + flow + push;

          // twinkle along the stream so dots feel like moving particles
          const twinkle =
            0.35 + (Math.sin(x * 0.03 - t * 3 + i * 0.6) * 0.5 + 0.5) * 0.65;

          // radius fades at the horizontal edges (soft mask)
          const edge = Math.min(1, Math.min(x, width - x) / 120);
          const edgeFade = Math.max(0, edge);

          const size = (0.7 + depthCurve * 2.2) * (0.6 + twinkle * 0.6);
          const alpha = (0.10 + depthCurve * 0.35) * twinkle * edgeFade;
          const blur = 2 + depthCurve * 10;

          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 90%, 58%, ${alpha})`;
          ctx.shadowColor = `hsla(${hue}, 95%, 62%, ${alpha * 1.4})`;
          ctx.shadowBlur = blur;
          ctx.fill();
        }
      }

      // reset shadow for perf hygiene
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("touchmove", onTouch);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1]"
    />
  );
}
