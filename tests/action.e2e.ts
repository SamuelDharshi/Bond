/**
 * Exercises the GitHub Action's core functions against the REAL GitHub API and the real chain.
 * Requires GITHUB_TOKEN (issues: write) and BOND_E2E_REPO=owner/repo (a repo you control, e.g. bond-demo).
 * Skipped with a notice otherwise.
 */
import { describe, expect, it } from 'vitest';
import { getOctokit } from '@actions/github';
import { Chain, getNetwork } from '@bond/core';
import { getBondStatus } from '@bond/contracts';
import {
  handleLabel,
  syncIssue,
  MARK,
  type Ctx,
  type GitHubApi,
  type IssueData,
} from '../packages/action/src/logic.js';
import { fundBond, loadWallets, testConfig, waitFor } from './lib.js';
import { record } from '../scripts/lib/txlog.js';
import { loadEnv } from '../scripts/lib/env.js';

loadEnv();
const token = process.env.GITHUB_TOKEN;
const target = process.env.BOND_E2E_REPO;
const enabled = Boolean(token && target);
if (!enabled) console.warn('NOTICE: action e2e skipped (set GITHUB_TOKEN and BOND_E2E_REPO=owner/repo to run it)');

describe.skipIf(!enabled)('GitHub Action logic (real GitHub API + real chain)', () => {
  it('bonded issue gets label + comment; `valid` label refunds on-chain', async () => {
    const [owner, repo] = target!.split('/');
    const octo = getOctokit(token!);
    const gh = octo as unknown as GitHubApi;
    const w = loadWallets();
    const config = testConfig(w);
    const chain = new Chain();
    await chain.connect();
    const SECTION = `action e2e (${getNetwork().name})`;
    try {
      // Labels must exist for addLabels on some repos.
      for (const name of [config.labels.bonded, config.labels.valid, config.labels.slop]) {
        await octo.rest.issues.createLabel({ owner, repo, name, color: 'ededed' }).catch(() => undefined);
      }
      const created = await octo.rest.issues.create({
        owner,
        repo,
        title: `Bond e2e ${new Date().toISOString()}`,
        body: 'Automated Bond e2e test issue.',
      });
      const number = created.data.number;
      const ctx: Ctx = {
        gh,
        chain,
        config,
        key: w.maintainer,
        owner,
        repo,
        log: console.log,
        appUrl: 'https://example.invalid',
      };

      // Unbonded -> one comment with link (idempotent)
      const fresh = (await octo.rest.issues.get({ owner, repo, issue_number: number })).data as unknown as IssueData;
      await syncIssue(ctx, fresh);
      await syncIssue(ctx, fresh);
      let comments = (await octo.rest.issues.listComments({ owner, repo, issue_number: number })).data;
      expect(comments.filter((c) => c.body?.includes(MARK.unbonded))).toHaveLength(1);

      // Fund a real bond for this issue, then sync -> bonded label + comment
      const fb = await fundBond(chain, config, { owner, repo, number }, w.contributor);
      record(SECTION, `fund: ${owner}/${repo}#${number}`, fb.fundingTxid);
      const r = await syncIssue(ctx, fresh);
      expect(r.status).toMatch(/bonded|reclaimable/);
      const after = (await octo.rest.issues.get({ owner, repo, issue_number: number })).data;
      expect(after.labels.map((l) => (typeof l === 'string' ? l : l.name))).toContain(config.labels.bonded);
      comments = (await octo.rest.issues.listComments({ owner, repo, issue_number: number })).data;
      expect(comments.some((c) => c.body?.includes(MARK.bonded(fb.fundingTxid)))).toBe(true);

      // Maintainer labels `valid` -> refund broadcast + comment
      await octo.rest.issues.addLabels({ owner, repo, issue_number: number, labels: [config.labels.valid] });
      const labelled = (await octo.rest.issues.get({ owner, repo, issue_number: number })).data as unknown as IssueData;
      const txids = await handleLabel(ctx, labelled, config.labels.valid);
      expect(txids).toHaveLength(1);
      record(SECTION, `action refund ${owner}/${repo}#${number}`, txids[0]);
      // Idempotent: a second run must not broadcast again
      expect(await handleLabel(ctx, labelled, config.labels.valid)).toHaveLength(0);
      const refunded = await waitFor(
        'refunded',
        async () => (await getBondStatus(chain, config, { owner, repo, number })).status === 'refunded',
        60_000,
        3000,
      );
      expect(refunded).toBe(true);
      await octo.rest.issues.update({ owner, repo, issue_number: number, state: 'closed' });
    } finally {
      await chain.close();
    }
  });
});
