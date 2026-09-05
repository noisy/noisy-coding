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
