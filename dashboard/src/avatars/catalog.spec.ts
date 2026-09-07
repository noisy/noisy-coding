import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AVATAR_SETS, AVATAR_VOICES, avatarCell } from './catalog';
import { VOICES } from '../components/characterMath';

describe('voice artwork coverage', () => {
  it('covers every voice assigned by the backend, including Aurora and Liora', () => {
    const backend = readFileSync(resolve('../src/noisy_coding/listener/http_api.py'), 'utf8');
    const pool = backend.match(/SUBAGENT_VOICE_POOL = \(([\s\S]*?)\)/)?.[1] ?? '';
    const voices = [...pool.matchAll(/"([^"]+)"/g)].map(match => match[1]);
    expect(voices.length).toBeGreaterThan(0);
    expect([...AVATAR_VOICES].sort()).toEqual(voices.sort());
    expect(Object.keys(VOICES).sort()).toEqual([...AVATAR_VOICES].sort());
    expect(new Set(AVATAR_VOICES).size).toBe(AVATAR_VOICES.length);
  });
  it('ships artwork and reusable prompts for every selectable set', () => {
    for (const set of AVATAR_SETS) {
      expect(existsSync(resolve(`src/assets/voice-avatars/${set.id}.png`)), set.id).toBe(true);
      expect(existsSync(resolve(`../docs/avatar-generation/prompts/${set.id}.txt`)), set.id).toBe(true);
    }
  });
  it('normalizes known identities and leaves future voices to the fallback', () => {
    expect(avatarCell(' AURORA ')).not.toBeNull();
    expect(avatarCell('liora')).not.toBeNull();
    expect(avatarCell('future-voice')).toBeNull();
  });
});
