export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function weightedMean(values: number[], weights: number[]): number {
  if (!values.length) return 0;
  const sw = weights.reduce((a, b) => a + b, 0);
  return sw ? values.reduce((sum, v, i) => sum + v * weights[i], 0) / sw : mean(values);
}

export function weightedMedian(values: number[], weights: number[]): number {
  if (!values.length) return 0;
  const pairs = values.map((v, i) => [v, weights[i]] as const).sort((a, b) => a[0] - b[0]);
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let running = 0;
  for (const [v, w] of pairs) {
    running += w;
    if (running >= total / 2) return v;
  }
  return pairs[pairs.length - 1][0];
}

export function weightedStd(values: number[], weights: number[], center = weightedMean(values, weights)): number {
  if (values.length < 2) return 0;
  const sw = weights.reduce((a, b) => a + b, 0);
  if (!sw) return 0;
  return Math.sqrt(values.reduce((s, v, i) => s + weights[i] * (v - center) ** 2, 0) / sw);
}

export function mad(values: number[]): number {
  if (!values.length) return 0;
  const m = median(values);
  return median(values.map((v) => Math.abs(v - m))) * 1.4826;
}

export function recencyWeights(length: number, decay = 0.84): number[] {
  return Array.from({ length }, (_, i) => decay ** (length - 1 - i));
}

export function robustify(values: number[]): number[] {
  if (values.length < 5) return [...values];
  const m = median(values);
  const sigma = Math.max(1, mad(values));
  const low = m - 3 * sigma;
  const high = m + 3 * sigma;
  return values.map((v) => Math.min(high, Math.max(low, v)));
}

export function normalPdf(x: number, meanValue: number, sigma: number): number {
  const s = Math.max(0.75, sigma);
  return Math.exp(-0.5 * ((x - meanValue) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
}

export function normalize(values: number[]): number[] {
  const sum = values.reduce((a, b) => a + b, 0);
  return sum > 0 ? values.map((v) => v / sum) : values.map(() => 0);
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = (s.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

export function logit(p: number): number {
  const q = clamp(p, 0.001, 0.999);
  return Math.log(q / (1 - q));
}

export function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
