import { onMounted, onUnmounted, type Ref } from 'vue';
import { gsap, gsapMatchMedia } from '@/plugins/gsap';
import { resolveBreakpointFlags } from '@/composables/useBreakpoints';

interface PageEnterOptions {
  selector?: string;
  y?: number;
  stagger?: number;
  delay?: number;
  duration?: number;
}

/** 页面内容编排入场：轻上移 + 淡入，无模糊 */
export function usePageEnter(
  container: Ref<HTMLElement | null>,
  options: PageEnterOptions = {},
): void {
  const {
    selector = '.page-enter',
    y = 6,
    stagger = 0.03,
    delay = 0,
    duration = 0.22,
  } = options;
  let ctx: gsap.Context | undefined;

  onMounted(() => {
    if (!container.value) return;
    if (resolveBreakpointFlags(window.innerWidth).isMobile) {
      gsap.set(container.value.querySelectorAll(selector), {
        autoAlpha: 1,
        y: 0,
        clearProps: 'all',
      });
      return;
    }
    ctx = gsap.context(() => {
      gsapMatchMedia.add('(prefers-reduced-motion: no-preference)', () => {
        const targets = gsap.utils.toArray<HTMLElement>(selector);
        if (!targets.length) return;

        gsap.from(targets, {
          y,
          autoAlpha: 0,
          stagger,
          delay,
          duration,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
        });
      });
    }, container.value);
  });

  onUnmounted(() => ctx?.revert());
}
