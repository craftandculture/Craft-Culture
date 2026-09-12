'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import Button from '@/app/_ui/components/Button/Button';
import Typography from '@/app/_ui/components/Typography/Typography';

interface SignaturePadProps {
  /** Called whenever the drawing changes. Null once cleared. */
  onChange: (dataUrl: string | null) => void;
  height?: number;
  label?: string;
}

/**
 * Finger/stylus signature capture for the warehouse tablet.
 *
 * Pointer events rather than mouse or touch handlers, so one code path covers
 * a finger, a stylus and a mouse. The canvas is sized to its own rendered box
 * and scaled by devicePixelRatio, otherwise the stroke lands offset from the
 * fingertip on a HiDPI screen and drifts further the wider the pad gets.
 *
 * @example
 *   <SignaturePad onChange={setSignature} />
 */
const SignaturePad = ({ onChange, height = 160, label }: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const context = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0a0a0a';
    return ctx;
  };

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    // Resizing clears the bitmap, so this only runs on mount and on orientation
    // change — never mid-signature.
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(ratio, ratio);
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener('orientationchange', resize);
    return () => window.removeEventListener('orientationchange', resize);
  }, [resize]);

  const pointFrom = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = context();
    if (!ctx) return;
    const { x, y } = pointFrom(e);
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = context();
    if (!ctx) return;
    const { x, y } = pointFrom(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  };

  /**
   * Export just the ink, not the pad.
   *
   * The canvas is far wider than a signature, so exporting it whole embeds a
   * mostly-empty image: the PDF scales the blank box to fit and the signature
   * inside it comes out tiny however much height it is given. Cropping to the
   * drawn pixels first means the height in the template is the height of the
   * signature.
   */
  const exportInk = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return null;

    const { width, height } = canvas;
    const { data } = ctx.getImageData(0, 0, width, height);
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        // Alpha channel — anything drawn is opaque, the rest is transparent.
        if (data[(y * width + x) * 4 + 3]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;

    const pad = Math.round(8 * (window.devicePixelRatio || 1));
    const sx = Math.max(0, minX - pad);
    const sy = Math.max(0, minY - pad);
    const sw = Math.min(width, maxX + pad) - sx;
    const sh = Math.min(height, maxY + pad) - sy;

    const out = document.createElement('canvas');
    out.width = sw;
    out.height = sh;
    const outCtx = out.getContext('2d');
    if (!outCtx) return null;
    outCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return out.toDataURL('image/png');
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(exportInk());
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <Typography variant="bodySm" colorRole="muted">
          {label}
        </Typography>
      ) : null}
      <div className="relative rounded-lg border-2 border-dashed border-border-primary bg-fill-primary">
        <canvas
          ref={canvasRef}
          style={{ height, touchAction: 'none' }}
          className="w-full cursor-crosshair rounded-lg"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
        />
        {!hasInk ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-text-muted">
            Sign here
          </span>
        ) : null}
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={clear} isDisabled={!hasInk}>
          Clear
        </Button>
      </div>
    </div>
  );
};

export default SignaturePad;
