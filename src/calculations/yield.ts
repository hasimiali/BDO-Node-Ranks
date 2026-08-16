export function calculateExpectedYield(averageYield: number | null, cyclesPerDay: number | null): number | null {
  if (averageYield == null || cyclesPerDay == null) return null;
  if (averageYield < 0 || cyclesPerDay < 0) return null;
  return averageYield * cyclesPerDay;
}
