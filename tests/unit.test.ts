// Pure-function unit tests: OP_RETURN codec, subjectHash, bond.json parsing. No network.
import { describe, expect, it } from 'vitest';
import {
  binToHex,
  decodeHintLockingBytecode,
  encodeHintLockingBytecode,
  hexToBin,
  parseBondConfig,
  parseIssueUrl,
  pkhToAddress,
  subjectHash,
  subjectString,
} from '@bond/core';

describe('subjectHash', () => {
  it('lowercases owner/repo and uses the documented format', () => {
    expect(subjectString({ owner: 'Curl', repo: 'CURL', number: 42 })).toBe('github:curl/curl#42');
  });
  it('is sha256 of the subject string', () => {
    // sha256("github:curl/curl#42") computed independently with node:crypto
    const ref = '17e4b189e3cc816975ae6c156acdd8b6c625fd06736c3df69fab60d703de4b2c';
    expect(binToHex(subjectHash({ owner: 'curl', repo: 'curl', number: 42 }))).toBe(ref);
    expect(binToHex(subjectHash({ owner: 'CURL', repo: 'Curl', number: 42 }))).toBe(ref);
  });
  it('differs per issue number', () => {
    expect(binToHex(subjectHash({ owner: 'a', repo: 'b', number: 1 }))).not.toBe(
      binToHex(subjectHash({ owner: 'a', repo: 'b', number: 2 })),
    );
  });
  it('parses issue and PR URLs', () => {
    expect(parseIssueUrl('https://github.com/Foo/bar.js/issues/12')).toEqual({
      owner: 'Foo',
      repo: 'bar.js',
      number: 12,
    });
    expect(parseIssueUrl('https://github.com/foo/bar/pull/3#discussion')).toEqual({
      owner: 'foo',
      repo: 'bar',
      number: 3,
    });
    expect(parseIssueUrl('foo/bar#9')).toEqual({ owner: 'foo', repo: 'bar', number: 9 });
    expect(() => parseIssueUrl('https://gitlab.com/x/y/issues/1')).toThrow();
  });
});

describe('OP_RETURN hint codec', () => {
  const sh = new Uint8Array(32).fill(7);
  const pkh = new Uint8Array(20).fill(9);
  it('round-trips and has the exact layout', () => {
    const lb = encodeHintLockingBytecode({ subjectHash: sh, contributorPkh: pkh });
    expect(lb.length).toBe(59);
    expect(binToHex(lb.slice(0, 7))).toBe('6a39' + '424f4e44' + '01');
    const d = decodeHintLockingBytecode(lb)!;
    expect(binToHex(d.subjectHash)).toBe(binToHex(sh));
    expect(binToHex(d.contributorPkh)).toBe(binToHex(pkh));
  });
  it('rejects wrong magic, version or length', () => {
    const lb = encodeHintLockingBytecode({ subjectHash: sh, contributorPkh: pkh });
    const badMagic = lb.slice();
    badMagic[2] = 0x41;
    const badVer = lb.slice();
    badVer[6] = 2;
    expect(decodeHintLockingBytecode(badMagic)).toBeUndefined();
    expect(decodeHintLockingBytecode(badVer)).toBeUndefined();
    expect(decodeHintLockingBytecode(lb.slice(0, 58))).toBeUndefined();
  });
});

describe('bond.json parsing', () => {
  const maintainerPkh = '0d7628ca241125b162b02c3136946295a655569b';
  const charity = pkhToAddress(hexToBin('0a96fcafd760ebf9aa2d9d10a68160689d7860d2'));
  const base = { version: 1, network: 'chipnet', maintainerPkh, charityAddress: charity, minValueSats: 50000 };
  it('applies defaults and resolves registry to the maintainer address', () => {
    const c = parseBondConfig(base);
    expect(c.reclaimBlocks).toBe(2016);
    expect(c.maxFeeSats).toBe(1500);
    expect(c.labels.slop).toBe('slop');
    expect(c.registryAddress).toBe(pkhToAddress(hexToBin(maintainerPkh)));
  });
  it('rejects maxFeeSats above 2000', () => {
    expect(() => parseBondConfig({ ...base, maxFeeSats: 2001 })).toThrow(/maxFeeSats/);
  });
  it('rejects bad pkh, bad address, wrong network', () => {
    expect(() => parseBondConfig({ ...base, maintainerPkh: 'zz' })).toThrow(/maintainerPkh/);
    expect(() => parseBondConfig({ ...base, charityAddress: 'nope' })).toThrow(/charityAddress/);
    expect(() => parseBondConfig({ ...base, network: 'mainnet' })).toThrow(/does not match/);
  });
  it('rejects charity == maintainer', () => {
    expect(() => parseBondConfig({ ...base, charityAddress: pkhToAddress(hexToBin(maintainerPkh)) })).toThrow(
      /charityAddress/,
    );
  });
  it('rejects reclaimBlocks outside the BIP68 block range', () => {
    expect(() => parseBondConfig({ ...base, reclaimBlocks: 0 })).toThrow();
    expect(() => parseBondConfig({ ...base, reclaimBlocks: 70000 })).toThrow();
  });
});
