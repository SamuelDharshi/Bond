// A simulated WizardConnect phone wallet talking to the app's real wallet code over the REAL relay and REAL chain.
// It proves the whole signing path: pairing, wallet_ready (xpubs), sign request (BigInt-safe), signature, broadcast.
// Run on chipnet only: BCH_NETWORK=chipnet pnpm e2e
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { MockNetworkProvider, SignatureTemplate, TransactionBuilder } from 'cashscript';
import { Chain, binToHex, getNetwork, parseBondConfig } from '@bond/core';
import { discoverBonds } from '@bond/contracts';
import { loadWallets, sleep } from './lib';
import { fundWithWizardConnect, readWallet } from '../packages/web/src/lib/wallet';

const WEB = '../packages/web/node_modules/@wizardconnect';
const core: any = await import(/* @vite-ignore */ `${WEB}/core/dist/index.js`);
const dappPkg: any = await import(/* @vite-ignore */ `${WEB}/dapp/dist/index.js`);
const libauth: any = await import(/* @vite-ignore */ '../packages/core/node_modules/@bitauth/libauth/build/index.js');

const RELAY = 'wss://relay.riften.net:443';
const net = getNetwork();

describe.skipIf(!net.isTestnet)('simulated WizardConnect wallet (real relay, real chain)', () => {
  it('pairs, shares xpubs, signs the funding request and the app broadcasts a real bond', async () => {
    const w = loadWallets();
    const chain = new Chain();
    await chain.connect();

    // --- a deterministic HD wallet (same seed every run, so test coins are reused) ---
    const seed = libauth.sha256.hash(new TextEncoder().encode('bond-wallet-simulator-v1'));
    const root = libauth.deriveHdPrivateNodeFromSeed(seed, { assumeValidity: true, throwErrors: true });
    const chainNode = (child: number) => libauth.deriveHdPath(root, `m/44'/145'/0'/${child}`);
    const xpubOf = (child: number) =>
      libauth.encodeHdPublicKey({
        network: 'mainnet',
        node: libauth.deriveHdPublicNode(chainNode(child)),
      }).hdPublicKey as string;
    const keyAt = (child: number, index: number): Uint8Array =>
      libauth.deriveHdPathRelative(chainNode(child), String(index)).privateKey;
    const addrAt = (child: number, index: number) => {
      const pub = libauth.secp256k1.derivePublicKeyCompressed(keyAt(child, index));
      return libauth.encodeCashAddress({
        prefix: net.addressPrefix,
        type: 'p2pkh',
        payload: libauth.hash160(pub),
      }).address as string;
    };
    const walletAddr = addrAt(0, 0);

    // --- make sure the simulated wallet owns some coins (free chipnet coins from the test contributor) ---
    if ((await chain.getBalance(walletAddr)) < 120_000n) {
      const sig = new SignatureTemplate(w.contributor.privateKey);
      const b = new TransactionBuilder({ provider: await chain.provider() });
      let total = 0n;
      for (const u of (await chain.getUtxos(w.contributor.address)).filter((x) => !x.token)) {
        b.addInputs([u], sig.unlockP2PKH());
        total += u.satoshis;
        if (total > 400_000n) break;
      }
      b.addOutput({ to: walletAddr, amount: 300_000n });
      b.addOutput({ to: w.contributor.address, amount: total - 300_000n - 6000n });
      await chain.broadcast(b.build());
      await sleep(4000);
    }

    // --- dApp side: exactly what @wizardconnect/react does inside the web app ---
    const manager = new dappPkg.DappConnectionManager('Bond test', undefined, { session: false });
    const relay = core.initiateDappRelay((p: any) => manager.updateConnection(p.client, p.status), {
      explicitRelayUrls: [RELAY],
    });
    manager.attachRelay(relay);

    // --- wallet side: a phone wallet that scans the URI ---
    const walletKey = libauth.generatePrivateKey();
    let walletClient: any = null;
    let walletConnected = false;
    let attachHook: (c: any) => void = () => undefined;
    const walletRelay = core.initiateWalletRelay(
      (p: any) => {
        if (!walletClient) {
          walletClient = p.client;
          attachHook(p.client);
        }
        if (p.status.status === 'connected') walletConnected = true;
      },
      {
        uri: relay.uri,
        walletPrivateKey: walletKey,
        explicitRelayUrls: [RELAY],
      },
    );
    const ready = {
      action: 'wallet_ready',
      time: Math.floor(Date.now() / 1000),
      wallet_name: 'Simulated wallet',
      wallet_icon: '',
      dapp_discovered: false,
      supported_protocols: ['hdwalletv1'],
      session: {
        hdwalletv1: {
          paths: [
            { name: 'receive', xpub: xpubOf(0) },
            { name: 'change', xpub: xpubOf(1) },
          ],
        },
      },
      public_key: binToHex(walletRelay.walletPublicKey),
      secret: walletRelay.secret,
    };
    const signed: string[] = [];
    const attach = (c: any) => {
      c.on('message', async (msg: any) => {
        if (msg?.action === 'dapp_ready' || msg?.action === 'ping') {
          if (msg.action === 'ping') await c.relay({ action: 'pong', time: Math.floor(Date.now() / 1000) });
          return;
        }
        if (msg?.action !== 'sign_transaction_request') return;
        // The request arrives as relay JSON: parse BigInt/Uint8Array back, then sign every input with its HD key.
        const wc = core.parseExtendedJson(JSON.stringify(msg.transaction)) as any;
        const tb = new TransactionBuilder({ provider: new MockNetworkProvider() });
        wc.transaction.inputs.forEach((inp: any, i: number) => {
          const [, , addrIndex] = msg.inputPaths.find((p: any) => p[0] === i);
          const [, pathName] = msg.inputPaths.find((p: any) => p[0] === i);
          const sk = keyAt(pathName === 'change' ? 1 : 0, addrIndex);
          const so = wc.sourceOutputs[i];
          tb.addInput(
            {
              txid: binToHex(inp.outpointTransactionHash),
              vout: inp.outpointIndex,
              satoshis: so.valueSatoshis,
              lockingBytecode: binToHex(so.lockingBytecode),
            } as any,
            new SignatureTemplate(sk).unlockP2PKH(),
          );
        });
        for (const o of wc.transaction.outputs) tb.addOutput({ to: o.lockingBytecode, amount: o.valueSatoshis } as any);
        const hex = tb.build();
        signed.push(hex);
        await c.relay({
          action: 'sign_transaction_response',
          time: Math.floor(Date.now() / 1000),
          sequence: msg.sequence,
          signedTransaction: hex,
        });
      });
    };
    attachHook = attach;
    if (walletClient) attach(walletClient);
    // send wallet_ready as soon as the wallet's relay connection is up
    for (let i = 0; i < 60 && !(walletConnected && walletClient); i++) await sleep(500);
    expect(walletConnected).toBe(true);
    await walletClient.relay(ready);

    // --- the app's own code: read the wallet, build the funding tx, ask the wallet to sign, broadcast ---
    for (let i = 0; i < 60 && !manager.hasPath(0); i++) await sleep(500);
    expect(manager.hasPath(0)).toBe(true);
    const config = parseBondConfig({
      version: 1,
      network: net.name,
      maintainerPkh: w.maintainer.pkhHex,
      charityAddress: w.charity.address,
      minValueSats: 50_000,
      reclaimBlocks: 1,
      maxFeeSats: 1500,
      registryAddress: w.maintainer.address,
    });
    const wallet = await readWallet(manager);
    expect(wallet.address).toBe(walletAddr);
    expect(wallet.balance).toBeGreaterThan(60_000n);
    const issue = { owner: 'bond-e2e', repo: `wallet-${Date.now().toString(36)}`, number: 1 };
    const res = await fundWithWizardConnect(manager, wallet, config, issue);

    expect(signed.length).toBe(1);
    expect(res.txid).toMatch(/^[0-9a-f]{64}$/);
    // The chain agrees: discovery finds exactly this bond from the registry history.
    await sleep(3000);
    const found = await discoverBonds(chain, config, issue);
    expect(found.some((b) => b.fundingTxid === res.txid && b.valueSats === 50_000n)).toBe(true);
    console.log(`  [wallet-sim] bond funded through the simulated wallet: ${net.explorerTx(res.txid)}`);

    await manager.destroy();
    relay.cleanup();
    walletRelay.cleanup();
    await chain.close();
  }, 240_000);
});
