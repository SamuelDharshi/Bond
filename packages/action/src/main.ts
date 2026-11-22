import * as core from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { Chain, getNetwork, keyFromWif } from '@bond/core';
import {
  assertMaintainerKey,
  handleLabel,
  loadConfig,
  sanitizeError,
  spendIssueBonds,
  sweep,
  syncIssue,
  type Ctx,
  type GitHubApi,
  type IssueData,
} from './logic.js';

async function run(): Promise<void> {
  const token = core.getInput('github-token', { required: true });
  const wif = core.getInput('maintainer-wif', { required: true });
  core.setSecret(wif);
  const configPath = core.getInput('config-path') || '.github/bond.json';
  const appUrl = core.getInput('app-url') || undefined;
  const autoReclaim = (core.getInput('auto-reclaim') || 'true') !== 'false';

  const gh = getOctokit(token) as unknown as GitHubApi;
  const { owner, repo } = context.repo;

  // 1. Config + key check (fail loudly on mismatch).
  const config = await loadConfig(gh, owner, repo, configPath);
  const key = keyFromWif(wif);
  assertMaintainerKey(config, key);
  core.info(`Bond: ${owner}/${repo} on ${getNetwork().name}, registry ${config.registryAddress}`);

  const chain = new Chain();
  await chain.connect();
  core.info(`Electrum: ${chain.connectedHost}`);
  const ctx: Ctx = { gh, chain, config, key, owner, repo, appUrl, autoReclaim, log: (m) => core.info(m) };

  try {
    const ev = context.eventName;
    const payload = context.payload as {
      action?: string;
      label?: { name?: string };
      issue?: IssueData;
      pull_request?: IssueData;
    };
    const issue = payload.issue ?? payload.pull_request;

    if (ev === 'schedule' || ev === 'workflow_dispatch') {
      const r = await sweep(ctx);
      core.info(`swept ${r.synced} open issues, reclaimed ${r.reclaimed.length}`);
      core.setOutput('txids', r.reclaimed.join(','));
      return;
    }
    if (!issue) {
      core.info(`event ${ev} has no issue; nothing to do`);
      return;
    }
    if (payload.action === 'labeled' && payload.label?.name) {
      const txids = await handleLabel(ctx, issue, payload.label.name);
      core.setOutput('txids', txids.join(','));
      return;
    }
    const r = await syncIssue(ctx, issue);
    core.info(`#${issue.number}: ${r.status} ${r.actions.join('; ')}`);
    // An issue that already carries a decision label but still has an unspent bond (e.g. labelled before funding):
    const names = issue.labels.map((l) => (typeof l === 'string' ? l : (l.name ?? '')));
    if (r.status === 'bonded' || r.status === 'reclaimable') {
      if (names.includes(config.labels.valid)) await spendIssueBonds(ctx, issue, 'refund');
      else if (names.includes(config.labels.slop)) await spendIssueBonds(ctx, issue, 'forfeit');
    }
  } finally {
    await chain.close();
  }
}

run().then(
  () => process.exit(0),
  (e: unknown) => {
    core.setFailed(sanitizeError(e));
    process.exit(1);
  },
);
