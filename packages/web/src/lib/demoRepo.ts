/** Sample repository used for the prefilled issue. Kept free of heavy imports so the landing page stays light. */
export const DEMO_REPO = (import.meta.env.VITE_DEMO_REPO || 'bond-demo/bond-demo').split('/') as [string, string];
export const DEMO_ISSUE_URL = `https://github.com/${DEMO_REPO[0]}/${DEMO_REPO[1]}/issues/1`;

export const isDemoRepo = (r: { owner: string; repo: string }) =>
  r.owner.toLowerCase() === DEMO_REPO[0].toLowerCase() && r.repo.toLowerCase() === DEMO_REPO[1].toLowerCase();
