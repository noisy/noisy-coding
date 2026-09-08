import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Companion from './Companion.vue';
beforeEach(()=> {
  vi.stubGlobal('requestAnimationFrame', ()=>1);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', ()=>({matches:true}));
});
afterEach(()=>vi.unstubAllGlobals());
describe('Companion state and routing',()=>{
  it.each([
    [{offline:true},'Offline'],[{muted:true},'Microphone muted'],[{voiceMuted:true},'Playback muted'],[{mode:'user'},'Recording'],[{mode:'claude'},'Speaking'],[{activity:'Checking tests'},'Working'],[{},'Ready'],
  ])('labels state %j', (props,label)=>{
    const wrapper=mount(Companion,{props:props as Record<string,never>});
    expect(wrapper.get('[role="status"]').text()).toBe(label);
    wrapper.unmount();
  });
  it('selects the exact agent identity from an accessible session button',async()=>{
    const wrapper=mount(Companion,{props:{agents:[{name:'codex-session',voice:'lux',active:true},{name:'claude-session',voice:'eve'}]}});
    await wrapper.get('button[aria-label="claude-session"]').trigger('click');
    expect(wrapper.emitted('select')).toEqual([['claude-session']]);
    wrapper.unmount();
  });
  it('shows the standalone waiting count independently of pending message arrays',()=>{
    const wrapper=mount(Companion,{props:{waiting:12}});
    expect(wrapper.get('.waiting').text()).toBe('9+');
    expect(wrapper.get('[role="status"]').text()).toBe('12 waiting');
    wrapper.unmount();
  });
});

/* Guard for #63. Chromium computes the desktop window's drag region from the
 * UNCLIPPED box of every element declaring -webkit-app-region, so a no-drag on
 * anything that scrolls inside .thread is subtracted from the title bar the
 * moment it scrolls out of view. The stylesheet is asserted as text because
 * happy-dom neither applies SFC styles nor knows about app regions. */
describe('Companion desktop drag region', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/Companion.vue'), 'utf8');
  const appRegionRules = [...source.matchAll(/^([^{\n][^{]*)\{[^}]*-webkit-app-region[^}]*\}/gm)].map(m => m[1].trim());
  it('declares app regions somewhere (the guard has something to guard)', () => {
    expect(appRegionRules.length).toBeGreaterThan(0);
  });
  it('never puts no-drag on scrolled thread content', () => {
    for (const selector of appRegionRules) {
      expect(selector, selector).not.toMatch(/\.msg\b/);
      // A bare `button` also reaches the buttons inside bubbles.
      for (const part of selector.split(',')) {
        if (/\bbutton\b/.test(part)) expect(part.trim(), part).toMatch(/\.rail\b/);
      }
    }
  });
  it('excludes the thread container itself', () => {
    expect(appRegionRules.some(s => /\.thread\s*$/.test(s))).toBe(true);
  });
});
