<script setup lang="ts">
defineProps<{
  title?: string;
  bordered?: boolean;
  /** 为 false 时允许地图等子元素正常溢出，避免裁切控件 */
  clipContent?: boolean;
}>();
</script>

<template>
  <div
    class="glow-card page-enter"
    :class="{ 'glow-card--no-clip': clipContent === false }"
  >
    <div v-if="title" class="glow-card__title">{{ title }}</div>
    <slot />
  </div>
</template>

<style scoped lang="scss">
.glow-card {
  background: #fff;
  border-radius: var(--tm-radius);
  border: 1px solid var(--tm-border);
  box-shadow: none;
  padding: 20px;
  position: relative;
  overflow: hidden;
  transition:
    border-color var(--tm-duration, 0.32s) var(--tm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    box-shadow var(--tm-duration, 0.32s) var(--tm-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    transform var(--tm-duration, 0.32s) var(--tm-ease-out, cubic-bezier(0.22, 1, 0.36, 1));

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    height: 2px;
    width: 100%;
    background: linear-gradient(90deg, #18181b, #0f766e);
    transform: scaleX(0);
    transform-origin: left center;
    transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: none;
  }

  &:hover {
    border-color: #d4d4d8;
    box-shadow: 0 12px 32px rgba(24, 24, 27, 0.06);
    transform: translateY(-2px);

    &::before {
      transform: scaleX(1);
    }
  }

  &--no-clip {
    overflow: visible;
  }
}

.glow-card__title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--tm-text);
  letter-spacing: -0.01em;
}

@media (prefers-reduced-motion: reduce) {
  .glow-card {
    transition: none;

    &:hover {
      transform: none;
    }
  }
}
</style>
