export const round2 = (n: number): number => {
  if (isNaN(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

export const sum2 = (arr: number[]): number => {
  return round2(arr.reduce((s, n) => s + (isNaN(n) ? 0 : n), 0));
};
