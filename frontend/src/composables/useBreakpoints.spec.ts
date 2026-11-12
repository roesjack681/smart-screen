import { describe, expect, it } from 'vitest';
import { BREAKPOINTS, resolveBreakpointFlags } from './useBreakpoints';

describe('resolveBreakpointFlags', () => {
  it('treats width below lg as mobile', () => {
    const flags = resolveBreakpointFlags(BREAKPOINTS.lg - 1);
    expect(flags.isMobile).toBe(true);
    expect(flags.isDesktop).toBe(false);
  });

  it('treats width at lg as desktop', () => {
    const flags = resolveBreakpointFlags(BREAKPOINTS.lg);
    expect(flags.isMobile).toBe(false);
    expect(flags.isDesktop).toBe(true);
  });

  it('treats tablet range between md and lg', () => {
    const flags = resolveBreakpointFlags(BREAKPOINTS.md);
    expect(flags.isTablet).toBe(true);
    expect(flags.isMobile).toBe(true);
    expect(flags.isDesktop).toBe(false);
  });
});
