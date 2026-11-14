import React, { useRef, useEffect } from 'react';

// Global cache to keep history across re-renders
const globalSpeedHistory = new Map();

export default function SpeedSparkline({ currentSpeed, isCompleted, infoHash }) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    const key = infoHash || 'default';
    if (!globalSpeedHistory.has(key)) {
      globalSpeedHistory.set(key, Array(30).fill(0));
    }
    const history = globalSpeedHistory.get(key);
    history.shift();
    history.push(currentSpeed || 0);

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    animFrameRef.current = requestAnimationFrame(() => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const maxVal = Math.max(...history, 1024 * 1024); // At least 1MB scale

      // Gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      if (isCompleted) {
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
      } else {
        gradient.addColorStop(0, 'rgba(37, 99, 235, 0.2)');
        gradient.addColorStop(1, 'rgba(37, 99, 235, 0.0)');
      }

      ctx.beginPath();
      const step = width / (history.length - 1);

      history.forEach((val, index) => {
        const x = index * step;
        const normalized = Math.min(val / maxVal, 1);
        const y = height - (normalized * (height - 6)) - 3;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          const prevX = (index - 1) * step;
          const prevNorm = Math.min(history[index - 1] / maxVal, 1);
          const prevY = height - (prevNorm * (height - 6)) - 3;
          const cpX = (prevX + x) / 2;
          ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
        }
      });

      ctx.strokeStyle = isCompleted ? '#10b981' : '#2563eb';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();
    });

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [currentSpeed, isCompleted, infoHash]);

  return (
    <canvas
      ref={canvasRef}
      width={140}
      height={36}
      className="w-24 sm:w-28 h-7 pointer-events-none opacity-90"
    />
  );
}
