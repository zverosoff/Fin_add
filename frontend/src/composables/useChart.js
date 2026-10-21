/**
 * Утилиты для рисования графиков на Canvas
 * с поддержкой Retina-дисплеев.
 */

/** Подготовить canvas к рисованию с учётом DPR */
export function prepareCanvas(canvas) {
  if (!canvas) return null;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const cssW = rect.width || canvas.width || 300;
  const cssH = rect.height || canvas.height || 200;

  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  return { ctx, w: cssW, h: cssH };
}

/** Округлённый прямоугольник */
export function roundRect(ctx, x, y, w, h, r) {
  if (h <= 0) h = 0.01;
  if (w <= 0) w = 0.01;
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Красивое «круглое» число для оси Y */
export function niceNumber(n) {
  if (!isFinite(n) || n <= 0) return 1;
  const exp = Math.floor(Math.log10(n));
  const base = Math.pow(10, exp);
  const norm = n / base;
  let nice;
  if (norm < 1.5) nice = 1;
  else if (norm < 3) nice = 2;
  else if (norm < 7) nice = 5;
  else nice = 10;
  return nice * base;
}

/** Короткий формат числа: 1200 → «1.2K», 1200000 → «1.2M» */
export function fmtShort(n) {
  if (!isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(0) + 'K';
  return String(Math.round(n));
}

/** Цвета темы */
export const CHART_COLORS = {
  income: '#22c55e',
  expense: '#dc2626',
  balance: '#0284c7',
  grid: 'rgba(15, 23, 42, 0.08)',
  text: '#0f172a',
  muted: '#64748b',
};

// ============================================================
// Столбчатая диаграмма: доходы/расходы по месяцам
// ============================================================
export function drawBarChart(canvas, data) {
  if (!canvas || !Array.isArray(data) || !data.length) return;

  const prepared = prepareCanvas(canvas);
  if (!prepared) return;
  const { ctx, w, h } = prepared;

  const hasData = data.some(d => d.income > 0 || d.expense > 0);
  if (!hasData) {
    ctx.fillStyle = CHART_COLORS.muted;
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Нет данных за период', w / 2, h / 2);
    return;
  }

  const padL = 46, padR = 12, padT = 30, padB = 36;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const max = Math.max(...data.map(d => Math.max(d.income, d.expense)), 1);
  const niceMax = niceNumber(max);

  // Сетка
  const steps = 4;
  ctx.setLineDash([3, 4]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = CHART_COLORS.grid;
  ctx.font = '10px Inter, sans-serif';
  ctx.fillStyle = CHART_COLORS.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let i = 0; i <= steps; i++) {
    const y = padT + chartH * (1 - i / steps);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
    ctx.fillText(fmtShort(niceMax * (i / steps)), padL - 6, y);
  }
  ctx.setLineDash([]);

  // Столбики
  const groupW = chartW / data.length;
  const barW = Math.min(22, groupW * 0.32);
  const gap = 3;

  data.forEach((d, i) => {
    const cx = padL + groupW * i + groupW / 2;
    const incH = (d.income / niceMax) * chartH;
    const expH = (d.expense / niceMax) * chartH;
    const incX = cx - barW - gap / 2;
    const expX = cx + gap / 2;

    if (d.income > 0) {
      const grad = ctx.createLinearGradient(0, padT + chartH - incH, 0, padT + chartH);
      grad.addColorStop(0, '#4ade80');
      grad.addColorStop(1, '#16a34a');
      ctx.fillStyle = grad;
      roundRect(ctx, incX, padT + chartH - incH, barW, incH, 5);
      ctx.fill();
    }

    if (d.expense > 0) {
      const grad = ctx.createLinearGradient(0, padT + chartH - expH, 0, padT + chartH);
      grad.addColorStop(0, '#f87171');
      grad.addColorStop(1, '#dc2626');
      ctx.fillStyle = grad;
      roundRect(ctx, expX, padT + chartH - expH, barW, expH, 5);
      ctx.fill();
    }

    // Метка месяца
    ctx.fillStyle = CHART_COLORS.muted;
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(d.label || '', cx, padT + chartH + 10);
  });
}

// ============================================================
// Линейный график: накопление баланса
// ============================================================
export function drawLineChart(canvas, data) {
  if (!canvas || !Array.isArray(data) || !data.length) return;

  const prepared = prepareCanvas(canvas);
  if (!prepared) return;
  const { ctx, w, h } = prepared;

  const hasData = data.some(d => d.balance !== 0);
  if (!hasData) {
    ctx.fillStyle = CHART_COLORS.muted;
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Нет данных за период', w / 2, h / 2);
    return;
  }

  const padL = 54, padR = 16, padT = 20, padB = 36;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const values = data.map(d => d.balance);
  const minV = Math.min(0, ...values);
  const maxV = Math.max(0, ...values);
  let range = maxV - minV;
  if (range <= 0) range = 1;
  const niceRange = niceNumber(range);

  // Сетка
  ctx.strokeStyle = CHART_COLORS.grid;
  ctx.fillStyle = CHART_COLORS.muted;
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const y = padT + chartH * (1 - i / steps);
    const val = minV + niceRange * (i / steps);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
    ctx.fillText(fmtShort(val), padL - 6, y);
  }

  // Точки
  const points = data.map((d, i) => {
    const x = padL + (chartW / Math.max(1, data.length - 1)) * i;
    const y = padT + chartH * (1 - (d.balance - minV) / niceRange);
    return { x, y, value: d.balance, label: d.label };
  });

  // Градиент под линией
  const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
  grad.addColorStop(0, 'rgba(2, 132, 199, 0.4)');
  grad.addColorStop(1, 'rgba(2, 132, 199, 0)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, padT + chartH);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, padT + chartH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Линия
  ctx.beginPath();
  ctx.strokeStyle = CHART_COLORS.balance;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();

  // Точки
  points.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = CHART_COLORS.balance;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Метки месяцев
  ctx.fillStyle = CHART_COLORS.muted;
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  points.forEach(p => ctx.fillText(p.label || '', p.x, padT + chartH + 8));
}