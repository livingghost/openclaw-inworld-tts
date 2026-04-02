export function normalizeResolvedSecretInputString(params: {
  value: unknown;
  path?: string;
}): string | undefined {
  const value = params.value;
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
