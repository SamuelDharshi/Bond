# FEEDBACK: a gap we found in the WizardConnect SDK

Written while building Bond for BCH BLAZE 2026. Everything below was observed in this project; the evidence column says where to check it.

**In one sentence:** WizardConnect's SDK can read the special `<bigint: 500n>` and `<Uint8Array: 0x…>` format that wallets send back, but it has no matching function to write it, so a dApp that hands it a normal transaction crashes with `Do not know how to serialize a BigInt`.

---

## 1. Summary

|                           |                                                                                                                                                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Technology**            | WizardConnect (`@wizardconnect/dapp` 0.2.8, `@wizardconnect/core` 0.2.11), used with CashScript 0.14                                                                                                                                                                         |
| **Where it hurts**        | The first time a dApp asks a wallet to sign: `manager.signTransaction(...)`                                                                                                                                                                                                  |
| **Symptom**               | `Signing failed: Do not know how to serialize a BigInt` (the user sees this in the middle of the pay flow)                                                                                                                                                                   |
| **Root cause**            | The relay layer sends messages with plain `JSON.stringify`. Transactions contain `bigint` and `Uint8Array`, which JSON cannot carry. The SDK ships helpers to **decode** the extended format but none to **encode** it, and the types claim the native objects are accepted. |
| **Who it affects**        | Every dApp developer who builds a transaction with CashScript or libauth and sends it to a WizardConnect wallet                                                                                                                                                              |
| **Our fix**               | A 10-line converter in our app (`toRelayJson` in `packages/web/src/lib/wallet.ts`)                                                                                                                                                                                           |
| **Proposed upstream fix** | Encode inside `signTransaction`, export the encoder, and add a test (section 6)                                                                                                                                                                                              |

---

## 2. The problem

A dApp using CashScript builds a signing request like this:

```ts
const transaction = builder.generateWcTransactionObject({ broadcast: false, userPrompt: '…' });
await manager.signTransaction({ transaction, inputPaths });
```

`generateWcTransactionObject` returns a libauth-style object. Amounts are `bigint` and scripts are `Uint8Array`. The call type-checks and looks correct. At runtime the connection manager hands the message to the relay client, which does:

```js
// @wizardconnect/core  dist/relay-client.js:236
const serialized = JSON.stringify(message);
```

`JSON.stringify` throws on any `bigint`, so the request never leaves the page. The user has already connected their wallet and pressed the pay button, and now sees an error.

## 3. The real pain point

The bug is small. The pain behind it is the design:

1. **The protocol already defines the encoding** (`<bigint: Xn>` and `<Uint8Array: 0x…>`), and the SDK documents that "both dApps and wallets should use these helpers". But only the **read** half exists: `parseExtendedJson`, `parseExtendedJsonValue`, `toUint8Array` and `toBigInt` (`@wizardconnect/core` `dist/serialize.js`). There is no `stringifyExtendedJson`.
2. **The types promise more than the runtime delivers.** `signTransaction` takes `transaction: WcSignTransactionRequest`, which is the native `@bch-wc2` type with `bigint` and `Uint8Array`. A developer reads that as "pass your transaction", and gets a crash instead of a type error. In our code the call also needed an `as unknown as …` cast, which hides exactly the mismatch that should have been a warning.
3. **The failure is far from the cause.** The error message names `BigInt`, not WizardConnect, not "your transaction", and not "encode it first". A developer has to read the SDK's relay code to learn what the relay expects.
4. **Wallets and dApps drift apart.** Because each dApp has to invent its own encoder, one that forgets a case (nested objects, `Uint8Array` inside arrays, `bigint` inside arrays) will fail only for some transactions, usually the larger ones.

This sits on the most important path in the product: the moment a user is asked to sign and pay. If it fails there, the user blames the dApp, and the dApp developer gives up on WizardConnect.

## 4. What could have been done

- **Make the encoder part of the SDK.** Whoever wrote the decode side already knows the format. Shipping `toExtendedJson` next to `parseExtendedJson` keeps both halves in sync.
- **Encode at the boundary, not in every app.** The place that calls `JSON.stringify` knows the message may contain native values, so it should use the matching encoder (a `JSON.stringify` replacer function).
- **Make the type honest.** Either the method accepts native transactions and encodes them, or it is typed to accept only the encoded form, so the compiler says what is needed.
- **Add one round-trip test.** Encode a real CashScript transaction, decode it with the existing parser, and assert equality. This would have caught the bug the first time anyone ran it.
- **Give a useful error.** If encoding still fails, say "signTransaction: the transaction contains a value that cannot be sent (path: `outputs[1].valueSatoshis`)".

## 5. Near-perfect solution

The ideal behaviour is that a dApp developer never has to think about this:

```ts
// what the developer writes (unchanged)
await manager.signTransaction({ transaction: builder.generateWcTransactionObject({ ... }), inputPaths });

// what the SDK does at the one place it serializes messages
const serialized = JSON.stringify(message, (_key, value) => {
  if (typeof value === 'bigint') return `<bigint: ${value}n>`;
  if (value instanceof Uint8Array) return `<Uint8Array: 0x${binToHex(value)}>`;
  return value;
});
```

Plus:

1. **Export the encoder** (`stringifyExtendedJson` and `toExtendedJson`) so wallets use the same one for their responses.
2. **Handle byte arrays correctly.** A plain `Uint8Array` reaches a `JSON.stringify` replacer unchanged, but a Node `Buffer` has its own `toJSON` and arrives as `{ type: 'Buffer', data: [...] }`. The encoder must cover both, which is why a test with real data is needed.
3. **Keep one spec.** Put the two formats (`<bigint: Xn>`, `<Uint8Array: 0x…>`) in the protocol document with an example of a full signing request, so third-party wallets and dApps can verify each other.
4. **A conformance test vector.** Publish one real transaction in both native and encoded form so every implementation can check itself.

## 6. Fix plan

| Step | Change                                                                                                 | Done when                                                            |
| ---- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 1    | Add `toExtendedJson(value)` and `stringifyExtendedJson(value)` to `@wizardconnect/core` `serialize.js` | The existing parser round-trips its output exactly                   |
| 2    | Use it in `relay-client.js` where `JSON.stringify(message)` is called (also the chunking path)         | A message containing `bigint` and `Uint8Array` is sent without error |
| 3    | Fix the `signTransaction` types so the compiler agrees with the runtime                                | The `as unknown as` cast is no longer needed in apps                 |
| 4    | Add a test with a real CashScript transaction (native → encode → decode → equal)                       | Test fails before step 2 and passes after                            |
| 5    | Improve the error message with the path of the first unsupported value                                 | A bad value points at its field                                      |
| 6    | Document the formats and add a conformance vector to the protocol docs                                 | Another implementation can validate against it                       |

Backwards compatibility: wallets already parse the extended format, so this changes nothing on their side. Apps that pre-encode (like ours) keep working if the encoder leaves strings unchanged, which it does.

## 7. What we did in Bond

We could not wait for an upstream change, so Bond encodes the transaction itself before calling `signTransaction`:

```ts
// packages/web/src/lib/wallet.ts
function toRelayJson(value: unknown): unknown {
  if (typeof value === 'bigint') return `<bigint: ${value}n>`;
  if (value instanceof Uint8Array) return `<Uint8Array: 0x${binToHex(value)}>`;
  if (Array.isArray(value)) return value.map(toRelayJson);
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toRelayJson(v)]));
  return value;
}
```

The call site passes `toRelayJson(transaction)`. Before this change the Bond "Lock deposit" step failed with `Signing failed: Do not know how to serialize a BigInt`; after it, the request reaches the relay.

## 8. Evidence

| Claim                                 | Where to check                                                                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| The relay uses plain `JSON.stringify` | `@wizardconnect/core@0.2.11` `dist/relay-client.js`, in `publishMessage`                                                                            |
| Only decode helpers exist             | `@wizardconnect/core` `dist/serialize.js` exports `parseExtendedJson`, `parseExtendedJsonValue`, `isExtendedJsonFormat`, `toUint8Array`, `toBigInt` |
| The request type is the native type   | `@wizardconnect/core` `dist/protocols/hdwalletv1.d.ts`, `SignTransactionRequest.transaction: WcSignTransactionRequest`                              |
| The runtime error we saw              | The Bond lock step: `Signing failed: Do not know how to serialize a BigInt`                                                                         |
| Our workaround                        | `packages/web/src/lib/wallet.ts` (`toRelayJson`)                                                                                                    |

**Not verified:** we have not tested the fix against a real WizardConnect wallet end to end, so we cannot say how a given wallet handles the encoded request. The error is proven; the wallet side of the fix is not.

---

## 9. A second, smaller pain point: relative timelocks on faster blocks

Found in the same build, in the CashScript and BCH tooling:

- A CashScript covenant using `this.age >= reclaimBlocks` compiles to a BIP68 block-based relative lock. Under Faster Blocks, BIP68 block locks keep their old 10-minute meaning, so on chipnet (1-minute blocks) one unit is about **10 blocks**, not 1.
- Local simulation and `debug()` pass. The node then rejects the real transaction with `non-BIP68-final`, which says nothing about "units" or "faster blocks".
- We handled it with a per-network setting (`relativeLockBlocksPerUnit` and a one-block safety margin in `packages/core/src/network.ts`) and by treating the node as the final judge.

**What could have been done:** a helper in the CashScript SDK that returns "confirmations required for this lock on this network", and a clearer debug warning when a relative lock is simulated on a network with non-legacy block times. We did not verify how the current CashScript documentation describes this, so treat this as an observation from our build, not a claim about their docs.
