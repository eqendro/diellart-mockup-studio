export const REGRESSION_FIXTURES = [
  { name: "diellart.png", mimeType: "image/png", runs: 20 },
  { name: "xhaura.jpg", mimeType: "image/jpeg", runs: 20 },
  { name: "aureva.png", mimeType: "image/png", runs: 20 },
  { name: "raffaello.jpg", mimeType: "image/jpeg", runs: 10 },
  { name: "ristorante-di-mare.jpg", mimeType: "image/jpeg", runs: 10 },
  { name: "vodafone.jpg", mimeType: "image/jpeg", runs: 10 },
] as const;

export type RegressionFixtureName = (typeof REGRESSION_FIXTURES)[number]["name"];

export function isRegressionFixtureName(value: string): value is RegressionFixtureName {
  return REGRESSION_FIXTURES.some((fixture) => fixture.name === value);
}
