/* Two machined reel flanges share a spindle. Draw their lathed profiles in a
   projected local plane so the thickness and the holes respond to the camera. */
window.drawReels = function (canvas, w, h, progress, orbit) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const pw = Math.round(w * dpr),
    ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (progress < 0.07) return;
  const visibility = Math.min(1, (progress - 0.07) / 0.32);
  ctx.globalAlpha = visibility;
  function reel(cx, cy, r, yaw, roll, spin) {
    const cos = Math.cos,
      sin = Math.sin,
      A = cos(yaw),
      dx = sin(yaw) * r * 0.19;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(roll);
    const face = new Path2D();
    face.arc(0, 0, r, 0, Math.PI * 2);
    const holes = 6;
    for (let i = 0; i < holes; i++) {
      const a = spin + (i * Math.PI * 2) / holes;
      const point = (x, y) => [r * (x * cos(a) - y * sin(a)), r * (x * sin(a) + y * cos(a))];
      face.moveTo(...point(0.42, -0.13));
      face.bezierCurveTo(...point(0.5, -0.24), ...point(0.81, -0.28), ...point(0.84, -0.14));
      face.bezierCurveTo(...point(0.87, -0.02), ...point(0.87, 0.12), ...point(0.82, 0.2));
      face.bezierCurveTo(...point(0.75, 0.27), ...point(0.5, 0.16), ...point(0.42, 0.1));
      face.bezierCurveTo(...point(0.37, 0.05), ...point(0.37, -0.05), ...point(0.42, -0.13));
      face.closePath();
    }
    function flange(z, dark) {
      ctx.save();
      ctx.translate(z, 0);
      ctx.scale(A, 1);
      const g = ctx.createLinearGradient(-r, -r, r, r);
      if (dark) {
        g.addColorStop(0, '#69645a');
        g.addColorStop(0.42, '#22282d');
        g.addColorStop(1, '#47484b');
      } else {
        g.addColorStop(0, '#b79970');
        g.addColorStop(0.17, '#56595a');
        g.addColorStop(0.38, '#222a31');
        g.addColorStop(0.59, '#6b665c');
        g.addColorStop(0.76, '#313840');
        g.addColorStop(1, '#c17e49');
      }
      ctx.fillStyle = g;
      ctx.fill(face, 'evenodd');
      ctx.strokeStyle = dark ? '#292b2c' : '#a8a197';
      ctx.lineWidth = Math.max(0.7, r * 0.006);
      ctx.stroke(face);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.974, 0, Math.PI * 2);
      ctx.strokeStyle = dark ? '#41464c' : '#575f65';
      ctx.stroke();
      ctx.restore();
    }
    flange(0, true);
    ctx.save();
    ctx.translate(dx * 0.45, 0);
    ctx.scale(A, 1);
    for (let ring = 0; ring < 17; ring++) {
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.87 - ring * 0.038), 0, Math.PI * 2);
      ctx.lineWidth = r * 0.036;
      ctx.strokeStyle = ring % 3 === 0 ? '#35312e' : '#232427';
      ctx.stroke();
    }
    ctx.restore();
    flange(dx, false);
    ctx.save();
    ctx.translate(dx * 1.08, 0);
    ctx.scale(A, 1);
    for (const [size, color] of [
      [0.23, '#242a2c'],
      [0.17, '#8b8273'],
      [0.13, '#353c42'],
      [0.075, '#b39c7e'],
      [0.039, '#26282b'],
    ]) {
      ctx.beginPath();
      ctx.arc(0, 0, r * size, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }
  reel(
    w * (0.82 + 0.055 * progress),
    h * (0.2 + 0.025 * progress),
    Math.min(h * 0.195, w * 0.125),
    0.87 + 0.06 * orbit,
    -0.32,
    -progress * 2.7,
  );
  reel(
    w * (-0.045 + 0.14 * progress),
    h * (0.24 + 0.045 * progress),
    Math.min(h * 0.13, w * 0.09),
    1.08 - 0.05 * orbit,
    0.23,
    progress * 3.3,
  );
  ctx.globalAlpha = 1;
};
