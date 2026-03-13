import { expandHostCandidates } from "./expand-host-candidates.js";

export const sqlLiteral = (value: string): string => {
  const escaped = value.replaceAll("'", "''");
  return `'${escaped}'`;
};

export const buildHostWhereClause = (hosts: string[], column: string): string => {
  const clauses: string[] = [];
  for (const host of hosts) {
    for (const candidate of expandHostCandidates(host)) {
      const escaped = sqlLiteral(candidate);
      const escapedDot = sqlLiteral(`.${candidate}`);
      const escapedLike = sqlLiteral(`%.${candidate}`);
      clauses.push(`${column} = ${escaped}`);
      clauses.push(`${column} = ${escapedDot}`);
      clauses.push(`${column} LIKE ${escapedLike}`);
    }
  }
  return clauses.length ? clauses.join(" OR ") : "1=0";
};

export const sqliteBool = (value: unknown): boolean => value === 1 || value === 1n;
