// pnpm demo:repo — publish demo-repo/ as a public GitHub repo, set the maintainer secret,
// create labels and open 3 demo issues. Uses `gh` if installed + authenticated; otherwise prints
// the exact manual steps.
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT, loadEnv, requireKey } from './lib/env.js';
import { demoRepo, writeDemoConfig } from './lib/demo.js';

loadEnv();
const { owner, repo } = demoRepo();
const actionOwner = process.env.BOND_ACTION_OWNER || owner;
const config = writeDemoConfig();
const maintainer = requireKey('MAINTAINER_WIF');

const ghOk = spawnSync('gh', ['auth', 'status'], { stdio: 'ignore', shell: process.platform === 'win32' }).status === 0;

const LABELS: [string, string, string][] = [
  [config.labels.bonded, '0e8a16', 'A refundable BCH deposit is locked for this issue'],
  [config.labels.valid, '1d76db', 'Genuine: refund the deposit'],
  [config.labels.slop, 'b60205', 'Spam: forfeit the deposit to charity'],
];
const ISSUES = [
  ['Demo: please bond me', 'A judge can bond this issue with the Bond web app, then label it `valid` or `slop`.'],
  ['Demo: crash when parsing empty config', 'Seeded demo issue (refunded path).'],
  ['Demo: AI-generated "critical vulnerability" report', 'Seeded demo issue (forfeited path).'],
];

function manual(): void {
  console.log(`
gh CLI is not installed/authenticated. Manual steps (≈3 minutes):

 1. Create a PUBLIC repo https://github.com/new  →  owner "${owner}", name "${repo}".
 2. Push the demo files:
      cd demo-repo
      sed -i "s/BOND_ACTION_OWNER/${actionOwner}/" .github/workflows/bond.yml
      git init -b main && git add -A && git commit -m "Bond demo"
      git remote add origin https://github.com/${owner}/${repo}.git && git push -u origin main
 3. Settings → Secrets and variables → Actions → New repository secret:
      Name:  BOND_MAINTAINER_WIF
      Value: ${maintainer.wif}
    (this is the PUBLIC demo key for a test network; it is also in the web app's demo pane)
 4. Issues → Labels → create: ${LABELS.map((l) => `"${l[0]}"`).join(', ')}
 5. Open 3 issues titled:
${ISSUES.map((i, n) => `      #${n + 1} ${i[0]}`).join('\n')}
    then open a 4th: "Demo: abandoned issue (reclaim path)".
 6. Make sure the Bond monorepo is public at https://github.com/${actionOwner}/bond so the workflow can use the Action.
 7. Set BOND_DEMO_REPO=${owner}/${repo} and VITE_DEMO_REPO=${owner}/${repo} in .env, then: pnpm demo:seed

Or install gh (https://cli.github.com), run \`gh auth login\`, and re-run \`pnpm demo:repo\`.
`);
}

if (!ghOk) {
  manual();
  process.exit(0);
}

const gh = (...args: string[]) =>
  execFileSync('gh', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }).trim();
const dir = mkdtempSync(join(tmpdir(), 'bond-demo-'));
cpSync(resolve(ROOT, 'demo-repo'), dir, { recursive: true });
const wf = join(dir, '.github', 'workflows', 'bond.yml');
writeFileSync(wf, readFileSync(wf, 'utf8').replace(/BOND_ACTION_OWNER/g, actionOwner));

const exists = spawnSync('gh', ['repo', 'view', `${owner}/${repo}`], { stdio: 'ignore' }).status === 0;
const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, stdio: 'inherit' });
git('init', '-q', '-b', 'main');
git('add', '-A');
git('-c', 'user.name=bond', '-c', 'user.email=bond@users.noreply.github.com', 'commit', '-qm', 'Bond demo repo');
if (!exists) {
  gh(
    'repo',
    'create',
    `${owner}/${repo}`,
    '--public',
    '--source',
    dir,
    '--push',
    '--description',
    'Bond demo: refundable anti-spam deposits on BCH',
  );
} else {
  git('remote', 'add', 'origin', `https://github.com/${owner}/${repo}.git`);
  git('push', '-f', 'origin', 'main');
}
execFileSync('gh', ['secret', 'set', 'BOND_MAINTAINER_WIF', '--repo', `${owner}/${repo}`, '--body', maintainer.wif], {
  stdio: 'inherit',
});
for (const [name, color, description] of LABELS) {
  spawnSync(
    'gh',
    ['label', 'create', name, '--repo', `${owner}/${repo}`, '--color', color, '--description', description, '--force'],
    { stdio: 'inherit' },
  );
}
const existing = JSON.parse(
  gh('issue', 'list', '--repo', `${owner}/${repo}`, '--state', 'all', '--json', 'number'),
) as unknown[];
if (existing.length === 0) {
  for (const [title, body] of [
    ...ISSUES,
    ['Demo: abandoned issue (reclaim path)', 'Seeded demo issue (reclaim path).'],
  ]) {
    console.log(gh('issue', 'create', '--repo', `${owner}/${repo}`, '--title', title, '--body', body));
  }
}
console.log(`\nDemo repo ready: https://github.com/${owner}/${repo}\nNext: pnpm demo:seed`);
