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

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL('image/png'));
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
