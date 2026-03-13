export const expandHostCandidates = (host: string): string[] => {
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 1) return [host];

  const candidates = new Set<string>();
  candidates.add(host);
  for (let index = 1; index <= parts.length - 2; index += 1) {
    const candidate = parts.slice(index).join(".");
    if (candidate) candidates.add(candidate);
  }
  return Array.from(candidates);
};
