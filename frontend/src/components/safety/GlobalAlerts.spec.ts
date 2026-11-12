// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { nextTick } from 'vue';
import App from '@/App.vue';
import { useSafetyStore } from '@/stores/safety';

afterEach(() => { document.body.innerHTML = ''; vi.useRealTimers(); });

it('根组件在空白业务页持续采样并展示全局弹窗和边框，卸载后停止', async () => {
  vi.useFakeTimers();
  const pinia = createPinia();
  const wrapper = mount(App, {
    attachTo: document.body,
    global: { plugins: [pinia], stubs: { RouterView: { template: '<main>其他业务页</main>' } } },
  });
  const store = useSafetyStore(pinia);
  try {
    expect(wrapper.text()).toContain('其他业务页');
    store.injectScenario('high', 'EXT-02');
    vi.advanceTimersByTime(3000);
    await nextTick();
    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('2号萃取罐');
    expect(document.querySelector('.ps-screen-alert.warning')).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/维护|工单/);
    store.acknowledge(store.pendingAlarms[0].id);
    await nextTick();
    // Transition leave hooks are synchronous in the test-utils transition stub.
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(document.querySelector('.ps-screen-alert.warning')).not.toBeNull();
    store.injectScenario('critical', 'EXT-02');
    vi.advanceTimersByTime(3000);
    await nextTick();
    expect(document.querySelector('.ps-alert-popup.critical')).not.toBeNull();
  } finally {
    wrapper.unmount();
  }
  expect(store.running).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
