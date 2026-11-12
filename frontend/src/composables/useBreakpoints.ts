import { computed, onMounted, onUnmounted, ref } from 'vue';

/** 与 Ant Design Vue Grid 对齐的断点（px） */
export const BREAKPOINTS = {
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
} as const;

function readWidth(): number {
  if (typeof window === 'undefined') return BREAKPOINTS.xl;
  return window.innerWidth;
}

export function resolveBreakpointFlags(innerWidth: number) {
  return {
    isMobile: innerWidth < BREAKPOINTS.lg,
    isTablet: innerWidth >= BREAKPOINTS.md && innerWidth < BREAKPOINTS.lg,
    isDesktop: innerWidth >= BREAKPOINTS.lg,
  };
}

export function useBreakpoints() {
  const width = ref(readWidth());

  function onResize(): void {
    width.value = readWidth();
  }

  onMounted(() => {
    window.addEventListener('resize', onResize, { passive: true });
  });

  onUnmounted(() => {
    window.removeEventListener('resize', onResize);
  });

  const flags = computed(() => resolveBreakpointFlags(width.value));

  const isMobile = computed(() => flags.value.isMobile);
  const isTablet = computed(() => flags.value.isTablet);
  const isDesktop = computed(() => flags.value.isDesktop);

  return { width, isMobile, isTablet, isDesktop };
}
