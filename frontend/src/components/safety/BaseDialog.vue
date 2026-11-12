<script setup>
import { onMounted, onBeforeUnmount, ref, nextTick } from 'vue'
import PsIcon from './PsIcon.vue'
defineProps({ title: String, subtitle: String, wide: Boolean })
const emit = defineEmits(['close'])
const dialog = ref(null)
let previousFocus, previousOverflow
function onKey(event) {
  if (event.key === 'Escape') { event.stopPropagation(); emit('close') }
  if (event.key !== 'Tab' || !dialog.value?.contains(document.activeElement)) return
  const elements = [...dialog.value.querySelectorAll('button:not(:disabled), input:not(:disabled), select, textarea, [tabindex="0"]')].filter(el => el.offsetParent !== null)
  if (!elements.length) return
  if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements.at(-1).focus() }
  else if (!event.shiftKey && document.activeElement === elements.at(-1)) { event.preventDefault(); elements[0].focus() }
}
onMounted(async () => { previousFocus = document.activeElement; previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; document.addEventListener('keydown', onKey); await nextTick(); dialog.value?.querySelector('input, select, button')?.focus() })
onBeforeUnmount(() => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKey); previousFocus?.focus?.() })
</script>
<template><Teleport to="body"><div class="ps-global-root"><div class="ps-dialog-backdrop" @click.self="emit('close')"><section ref="dialog" class="ps-dialog" :class="{ wide }" role="dialog" aria-modal="true" aria-labelledby="ps-dialog-title"><header class="ps-dialog-header"><div><h2 id="ps-dialog-title">{{ title }}</h2><p v-if="subtitle">{{ subtitle }}</p></div><button class="ps-icon-button" aria-label="关闭对话框" @click="emit('close')"><PsIcon name="X" :size="22"/></button></header><div class="ps-dialog-body"><slot/></div></section></div></div></Teleport></template>
