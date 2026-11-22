import { sha256Bin, utf8ToBin } from './bytes.js';

export interface IssueRef {
  owner: string;
  repo: string;
  number: number;
}

/** Canonical subject string: github:<owner>/<repo>#<number>, owner/repo lowercased. */
export function subjectString(ref: IssueRef): string {
  if (!Number.isInteger(ref.number) || ref.number <= 0) throw new Error(`Invalid issue number ${ref.number}`);
  return `github:${ref.owner.toLowerCase()}/${ref.repo.toLowerCase()}#${ref.number}`;
}

/** subjectHash = sha256(utf8("github:" + owner.lower + "/" + repo.lower + "#" + number)) */
export function subjectHash(ref: IssueRef): Uint8Array {
  return sha256Bin(utf8ToBin(subjectString(ref)));
}

/** Accepts https://github.com/o/r/issues/1, .../pull/1, or o/r#1. */
export function parseIssueUrl(input: string): IssueRef {
  const s = input.trim();
  const m =
    s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)\/(?:issues|pull)\/(\d+)(?:[/?#].*)?$/i) ??
    s.match(/^([\w.-]+)\/([\w.-]+)#(\d+)$/);
  if (!m) throw new Error('Expected a GitHub issue/PR URL like https://github.com/owner/repo/issues/1');
  return { owner: m[1], repo: m[2], number: Number(m[3]) };
}

export const issueUrl = (r: IssueRef): string => `https://github.com/${r.owner}/${r.repo}/issues/${r.number}`;
