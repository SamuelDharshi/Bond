import { SignatureTemplate } from 'cashscript';
import {
  BroadcastError,
  isTimelockNotReached,
  notYetMessage,
  getNetwork,
  issueUrl,
  parseBondConfig,
  setNetworkIfUnset,
  isNetworkName,
  type BondConfig,
  type Chain,
  type IssueRef,
  type KeyInfo,
} from '@bond/core';
import {
  buildForfeitTx,
  buildRefundTx,
  buildReclaimTx,
  discoverAllBonds,
  discoverBonds,
  summarizeStatus,
  type DiscoveredBond,
} from '@bond/contracts';
import { binToHex, subjectHash } from '@bond/core';

/** Minimal Octokit surface we use (keeps logic testable with the real client). */
export interface GitHubApi {
  rest: {
    repos: { getContent(p: { owner: string; repo: string; path: string; ref?: string }): Promise<{ data: unknown }> };
    issues: {
      get(p: { owner: string; repo: string; issue_number: number }): Promise<{ data: IssueData }>;
      listComments(p: {
        owner: string;
        repo: string;
        issue_number: number;
        per_page?: number;
        page?: number;
      }): Promise<{ data: { body?: string | null }[] }>;
      createComment(p: { owner: string; repo: string; issue_number: number; body: string }): Promise<unknown>;
      addLabels(p: { owner: string; repo: string; issue_number: number; labels: string[] }): Promise<unknown>;
      removeLabel(p: { owner: string; repo: string; issue_number: number; name: string }): Promise<unknown>;
      listForRepo(p: {
        owner: string;
        repo: string;
        state: 'open' | 'closed' | 'all';
        per_page?: number;
        page?: number;
      }): Promise<{ data: IssueData[] }>;
    };
  };
}

export interface IssueData {
  number: number;
  state?: string;
  labels: (string | { name?: string | null })[];
  user?: { login?: string } | null;
}

export interface Ctx {
  gh: GitHubApi;
  chain: Chain;
  config: BondConfig;
  key: KeyInfo;
  owner: string;
  repo: string;
  appUrl?: string;
  log: (msg: string) => void;
  /** Default true: scheduled runs broadcast permissionless reclaim() for timed-out bonds. */
  autoReclaim?: boolean;
}

export const MARK = {
  bonded: (txid: string) => `<!-- bond:bonded:${txid} -->`,
  unbonded: '<!-- bond:unbonded -->',
  spent: (kind: string, txid: string) => `<!-- bond:${kind}:${txid} -->`,
};

/** Never leak CashScript debug URIs (they can embed private keys) or multi-line dumps. */
export function sanitizeError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m
    .split('\n')[0]
    .replace(/https?:\/\/ide\.bitauth\.com\S*/g, '[redacted]')
    .slice(0, 300);
}

export async function loadConfig(gh: GitHubApi, owner: string, repo: string, path: string): Promise<BondConfig> {
  const res = await gh.rest.repos.getContent({ owner, repo, path });
  const d = res.data as { content?: string; encoding?: string };
  if (!d.content) throw new Error(`${path} not found or is a directory`);
  const raw = JSON.parse(Buffer.from(d.content, (d.encoding as BufferEncoding) ?? 'base64').toString('utf8')) as {
    network?: unknown;
  };
  // BCH_NETWORK wins; if unset in the workflow, the repo's bond.json decides.
  if (isNetworkName(raw.network)) setNetworkIfUnset(raw.network);
  return parseBondConfig(raw);
}

export function assertMaintainerKey(config: BondConfig, key: KeyInfo): void {
  if (key.pkhHex !== config.maintainerPkh) {
    throw new Error(
      `maintainer-wif does not match bond.json maintainerPkh (key pkh ${key.pkhHex}, config ${config.maintainerPkh}). Refusing to run.`,
    );
  }
}

const labelNames = (i: IssueData) => i.labels.map((l) => (typeof l === 'string' ? l : (l.name ?? '')));
const sats = (v: bigint) => `${v.toLocaleString('en-US')} sats`;
const ref = (ctx: Ctx, number: number): IssueRef => ({ owner: ctx.owner, repo: ctx.repo, number });

async function allComments(ctx: Ctx, number: number): Promise<string[]> {
  const out: string[] = [];
  for (let page = 1; page < 20; page++) {
    const { data } = await ctx.gh.rest.issues.listComments({
      owner: ctx.owner,
      repo: ctx.repo,
      issue_number: number,
      per_page: 100,
      page,
    });
    out.push(...data.map((c) => c.body ?? ''));
    if (data.length < 100) break;
  }
  return out;
}

async function commentOnce(ctx: Ctx, number: number, marker: string, body: string): Promise<boolean> {
  const existing = await allComments(ctx, number);
  if (existing.some((c) => c.includes(marker))) return false;
  await ctx.gh.rest.issues.createComment({
    owner: ctx.owner,
    repo: ctx.repo,
    issue_number: number,
    body: `${body}\n\n${marker}`,
  });
  return true;
}

async function addLabel(ctx: Ctx, number: number, label: string, current: string[]): Promise<void> {
  if (current.includes(label)) return;
  await ctx.gh.rest.issues.addLabels({ owner: ctx.owner, repo: ctx.repo, issue_number: number, labels: [label] });
}

async function removeLabel(ctx: Ctx, number: number, label: string, current: string[]): Promise<void> {
  if (!current.includes(label)) return;
  await ctx.gh.rest.issues
    .removeLabel({ owner: ctx.owner, repo: ctx.repo, issue_number: number, name: label })
    .catch(() => undefined);
}

export function bondPageUrl(ctx: Ctx, number: number): string | undefined {
  const base = ctx.appUrl ?? ctx.config.appUrl;
  if (!base) return undefined;
  return `${base.replace(/\/$/, '')}/#/bond?issue=${encodeURIComponent(issueUrl(ref(ctx, number)))}`;
}

export type SyncResult = { status: string; actions: string[] };

/** bonded -> label + one comment; unbonded -> one comment linking to the bond page. */
export async function syncIssue(ctx: Ctx, issue: IssueData, known?: DiscoveredBond[]): Promise<SyncResult> {
  const bonds = known ?? (await discoverBonds(ctx.chain, ctx.config, ref(ctx, issue.number)));
  const status = summarizeStatus(bonds);
  const labels = labelNames(issue);
  const actions: string[] = [];
  const net = getNetwork();
  const live = bonds.filter((b) => b.status === 'bonded' || b.status === 'reclaimable');
  if (live.length > 0) {
    await addLabel(ctx, issue.number, ctx.config.labels.bonded, labels);
    for (const b of live) {
      const posted = await commentOnce(
        ctx,
        issue.number,
        MARK.bonded(b.fundingTxid),
        [
          `### 🔒 Bonded: ${sats(b.valueSats)}`,
          `A refundable deposit is locked for this issue in a Bitcoin Cash covenant.`,
          '',
          `| | |`,
          `|---|---|`,
          `| Amount | **${sats(b.valueSats)}** (${net.label}) |`,
          `| Contract | [\`${b.bond.address}\`](${net.explorerAddress(b.bond.address)}) |`,
          `| Funding tx | [\`${b.fundingTxid.slice(0, 16)}…\`](${net.explorerTx(b.fundingTxid)}) |`,
          `| Timeout | ${ctx.config.reclaimBlocks} block(s) after confirmation, then anyone can return it to the contributor |`,
          '',
          `Maintainers: label **\`${ctx.config.labels.valid}\`** to refund, **\`${ctx.config.labels.slop}\`** to forfeit it to charity. The maintainer can never receive the deposit.`,
        ].join('\n'),
      );
      if (posted) actions.push(`commented bonded ${b.fundingTxid}`);
    }
  } else if (status === 'unfunded' && issue.state !== 'closed') {
    const url = bondPageUrl(ctx, issue.number);
    const posted = await commentOnce(
      ctx,
      issue.number,
      MARK.unbonded,
      [
        `### 👋 This repo uses Bond`,
        `To reach a maintainer, lock a refundable deposit of **${sats(BigInt(ctx.config.minValueSats))}** for this issue.`,
        `It is refunded when the issue is marked \`${ctx.config.labels.valid}\`, or after a timeout. Spam (\`${ctx.config.labels.slop}\`) goes to charity.`,
        '',
        url ? `👉 **[Bond this issue](${url})**` : `Bond it with the Bond web app using this issue's URL.`,
      ].join('\n'),
    );
    if (posted) actions.push('commented unbonded');
  }
  return { status, actions };
}

type SpendKind = 'refund' | 'forfeit' | 'reclaim';

/** Spend every still-unspent bond on an issue. Re-checks chain state right before spending. */
export async function spendIssueBonds(ctx: Ctx, issue: IssueData, kind: SpendKind): Promise<string[]> {
  const fresh = await discoverBonds(ctx.chain, ctx.config, ref(ctx, issue.number));
  const targets = fresh.filter((b) =>
    kind === 'reclaim' ? b.status === 'reclaimable' : b.status === 'bonded' || b.status === 'reclaimable',
  );
  const txids: string[] = [];
  const provider = await ctx.chain.provider();
  const maintainerKey = new SignatureTemplate(ctx.key.privateKey);
  const net = getNetwork();
  const labels = labelNames(issue);
  for (const b of targets) {
    if (!b.utxo) continue; // spent but indexer lagging: never double-spend
    const existing = await allComments(ctx, issue.number);
    if (existing.some((c) => c.includes(MARK.spent(kind, b.fundingTxid)))) continue;
    let txid: string;
    try {
      const hex =
        kind === 'refund'
          ? buildRefundTx({ bond: b.bond, utxo: b.utxo, provider, maintainerKey })
          : kind === 'forfeit'
            ? buildForfeitTx({ bond: b.bond, utxo: b.utxo, provider, maintainerKey })
            : buildReclaimTx({ bond: b.bond, utxo: b.utxo, provider });
      txid = await ctx.chain.broadcast(hex);
    } catch (e) {
      const msg = sanitizeError(e);
      if (kind === 'reclaim' && isTimelockNotReached(e)) {
        ctx.log(`bond ${b.fundingTxid}: ${notYetMessage(b.confirmations, ctx.config.reclaimBlocks)}`);
        continue;
      }
      if (e instanceof BroadcastError && /already|missing inputs|txn-mempool-conflict/i.test(msg)) {
        ctx.log(`bond ${b.fundingTxid} already being spent (${msg}); skipping`);
        continue;
      }
      throw new Error(`${kind} of ${b.fundingTxid} failed: ${msg}`, { cause: e });
    }
    txids.push(txid);
    const dest = kind === 'forfeit' ? `the charity address \`${ctx.config.charityAddress}\`` : `the contributor`;
    const title =
      kind === 'refund'
        ? '✅ Deposit refunded'
        : kind === 'forfeit'
          ? '🧹 Deposit forfeited to charity'
          : '⏳ Timeout: deposit returned';
    await ctx.gh.rest.issues.createComment({
      owner: ctx.owner,
      repo: ctx.repo,
      issue_number: issue.number,
      body: `### ${title}\n${sats(b.valueSats)} sent to ${dest}.\n\nTx: [\`${txid}\`](${net.explorerTx(txid)})\n\n${MARK.spent(kind, b.fundingTxid)}`,
    });
    ctx.log(`${kind} ${b.fundingTxid} -> ${txid}`);
  }
  if (txids.length > 0 || fresh.every((b) => b.status !== 'bonded' && b.status !== 'reclaimable')) {
    await removeLabel(ctx, issue.number, ctx.config.labels.bonded, labels);
  }
  return txids;
}

/** Label event: valid -> refund, slop -> forfeit. Anything else -> sync. */
export async function handleLabel(ctx: Ctx, issue: IssueData, label: string): Promise<string[]> {
  if (label === ctx.config.labels.valid) return spendIssueBonds(ctx, issue, 'refund');
  if (label === ctx.config.labels.slop) return spendIssueBonds(ctx, issue, 'forfeit');
  await syncIssue(ctx, issue);
  return [];
}

/** Scheduled / manual: one registry scan for every open issue; sync each; reclaim timed-out bonds. */
export async function sweep(ctx: Ctx): Promise<{ synced: number; reclaimed: string[] }> {
  const issues: IssueData[] = [];
  for (let page = 1; page < 20; page++) {
    const { data } = await ctx.gh.rest.issues.listForRepo({
      owner: ctx.owner,
      repo: ctx.repo,
      state: 'open',
      per_page: 100,
      page,
    });
    issues.push(...data);
    if (data.length < 100) break;
  }
  const map = await discoverAllBonds(
    ctx.chain,
    ctx.config,
    issues.map((i) => ref(ctx, i.number)),
  );
  const reclaimed: string[] = [];
  for (const issue of issues) {
    const bonds = map.get(binToHex(subjectHash(ref(ctx, issue.number)))) ?? [];
    const labels = labelNames(issue);
    try {
      // Pending maintainer decisions take priority over timeouts.
      if (labels.includes(ctx.config.labels.valid) && bonds.some((b) => b.utxo)) {
        await spendIssueBonds(ctx, issue, 'refund');
        continue;
      }
      if (labels.includes(ctx.config.labels.slop) && bonds.some((b) => b.utxo)) {
        await spendIssueBonds(ctx, issue, 'forfeit');
        continue;
      }
      if (ctx.autoReclaim !== false && bonds.some((b) => b.status === 'reclaimable')) {
        reclaimed.push(...(await spendIssueBonds(ctx, issue, 'reclaim')));
        continue;
      }
      await syncIssue(ctx, issue, bonds);
    } catch (e) {
      ctx.log(`issue #${issue.number}: ${sanitizeError(e)}`);
    }
  }
  return { synced: issues.length, reclaimed };
}
