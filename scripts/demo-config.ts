// pnpm demo:config — regenerate demo-repo/.github/bond.json from the keys in .env.
import { DEMO_CONFIG_PATH, writeDemoConfig } from './lib/demo.js';
const c = writeDemoConfig();
console.log(
  `wrote ${DEMO_CONFIG_PATH}\n  maintainerPkh ${c.maintainerPkh}\n  charity ${c.charityAddress}\n  registry ${c.registryAddress}`,
);
