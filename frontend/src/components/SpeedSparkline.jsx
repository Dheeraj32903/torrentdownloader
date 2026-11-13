import React, { useRef, useEffect } from 'react';

export default function SpeedSparkline({ currentSpeed, isCompleted }) {
  const canvasRef = useRef(null);
  const historyRef = useRef(Array(40).fill(0));

  useEffect(() => {
    // Push current speed to circular buffer
    const history = historyRef.current;
    history.shift();
    history.push(currentSpeed || 0);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const maxVal = Math.max(...history, 1024 * 1024); // at least 1MB scale

    // Build gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    if (isCompleted) {
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
    } else {
      gradient.addColorStop(0, 'rgba(79, 70, 229, 0.25)');
      gradient.addColorStop(1, 'rgba(79, 70, 229, 0.0)');
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
        // Smooth bezier curve
        const prevX = (index - 1) * step;
        const prevNorm = Math.min(history[index - 1] / maxVal, 1);
        const prevY = height - (prevNorm * (height - 6)) - 3;
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    });

    // Stroke line
    ctx.strokeStyle = isCompleted ? '#059669' : '#4f46e5';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = isCompleted ? 'rgba(16, 185, 129, 0.35)' : 'rgba(79, 70, 229, 0.35)';
    ctx.shadowBlur = 4;
    ctx.stroke();

    // Fill area below line
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.shadowBlur = 0;
    ctx.fill();
  }, [currentSpeed, isCompleted]);

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={40}
      className="w-28 sm:w-36 h-9 rounded-lg opacity-90"
    />
  );
}
