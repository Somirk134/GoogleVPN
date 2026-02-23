// 共享工具函数

export function formatSpeed(bytes) {
  if (!bytes || bytes === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 安全地读取 SSE 流的第一行数据然后关闭
 * 避免每次 fetch SSE 端点都泄漏连接
 */
export async function fetchSSEOnce(url, headers = {}, timeout = 3000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, { headers, signal: controller.signal });
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const idx = buffer.indexOf('\n');
        if (idx !== -1) {
          const line = buffer.slice(0, idx).trim();
          if (line) {
            return JSON.parse(line);
          }
          buffer = buffer.slice(idx + 1);
        }
      }
    } finally {
      reader.cancel().catch(() => {});
    }
  } finally {
    clearTimeout(timeoutId);
  }
  return null;
}

/**
 * 将数值取整到好看的刻度
 */
export function niceNum(val) {
  const units = [1, 1024, 1024 * 1024, 1024 * 1024 * 1024];
  for (let i = units.length - 1; i >= 0; i--) {
    if (val >= units[i]) {
      const scaled = val / units[i];
      const nice = Math.ceil(scaled / 5) * 5;
      return nice * units[i];
    }
  }
  return 1024;
}

/**
 * 通用流量图绘制
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} opts
 */
export function drawTrafficChart(ctx, opts) {
  const {
    width, height,
    upData, downData,
    maxPoints,
    padTop = 0, padBottom = 0, padLeft = 0, padRight = 0,
    showGrid = false, showLabels = false, showLegend = false,
    smooth = false,
    isDark = true,
  } = opts;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  ctx.clearRect(0, 0, width, height);

  // 用固定长度数组，不足的前面补 0
  const upFull = new Array(maxPoints).fill(0);
  const downFull = new Array(maxPoints).fill(0);
  for (let i = 0; i < upData.length; i++) upFull[maxPoints - upData.length + i] = upData[i];
  for (let i = 0; i < downData.length; i++) downFull[maxPoints - downData.length + i] = downData[i];

  const allVals = [...upFull, ...downFull];
  const rawMax = Math.max(...allVals, 1024);
  const maxVal = showLabels ? niceNum(rawMax) : rawMax;
  const stepX = chartW / (maxPoints - 1);

  // 网格线
  if (showGrid) {
    const gridLines = 4;
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillStyle = isDark ? '#484f58' : '#9ca3af';
    ctx.textAlign = 'right';
    for (let i = 0; i <= gridLines; i++) {
      const y = padTop + (chartH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
      if (showLabels) {
        const val = maxVal * (1 - i / gridLines);
        ctx.fillText(formatSpeed(val).replace('/s', ''), padLeft - 6, y + 3);
      }
    }
  }

  if (upData.length < 2 && downData.length < 2) return;

  const toY = (v) => padTop + chartH - (v / maxVal) * chartH;

  // 下载（橙色）
  _drawArea(ctx, downFull, stepX, toY, padLeft, padTop + chartH, '#fb923c', 0.2, smooth);
  // 上传（蓝色）
  _drawArea(ctx, upFull, stepX, toY, padLeft, padTop + chartH, '#38bdf8', 0.15, smooth);

  // 图例
  if (showLegend) {
    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillStyle = '#38bdf8'; ctx.fillText('↑ 上传', width - 100, 14);
    ctx.fillStyle = '#fb923c'; ctx.fillText('↓ 下载', width - 46, 14);
  }
}

function _drawArea(ctx, data, stepX, toY, offsetX, bottomY, color, alpha, smooth) {
  const pts = data.length;
  if (pts < 2) return;

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.moveTo(offsetX, toY(data[0]));
  for (let i = 1; i < pts; i++) {
    const x0 = offsetX + (i - 1) * stepX;
    const x1 = offsetX + i * stepX;
    const y0 = toY(data[i - 1]);
    const y1 = toY(data[i]);
    if (smooth) {
      const cpx = (x0 + x1) / 2;
      ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
    } else {
      ctx.lineTo(x1, y1);
    }
  }
  ctx.stroke();

  // 填充渐变
  ctx.lineTo(offsetX + (pts - 1) * stepX, bottomY);
  ctx.lineTo(offsetX, bottomY);
  ctx.closePath();
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const grad = ctx.createLinearGradient(0, 0, 0, bottomY);
  grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fill();
}
