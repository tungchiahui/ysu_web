<script setup lang="ts">
const props = defineProps<{ open: boolean; labelledby: string }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)
let previousOverflow: string | undefined
let notified = false
function restoreScroll() {
  if (previousOverflow !== undefined) {
    document.body.style.overflow = previousOverflow
    previousOverflow = undefined
  }
}
function closed() {
  restoreScroll()
  if (!notified) { notified = true; emit('close') }
}
function dismiss() { dialog.value?.close(); closed() }
function trapFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !dialog.value) return
  const controls = [...dialog.value.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0)
  const first = controls[0], last = controls.at(-1)
  if (!first) { event.preventDefault(); dialog.value.focus(); return }
  if (event.shiftKey && (document.activeElement === first || !dialog.value.contains(document.activeElement))) {
    event.preventDefault(); last?.focus()
  } else if (!event.shiftKey && (document.activeElement === last || !dialog.value.contains(document.activeElement))) {
    event.preventDefault(); first.focus()
  }
}
function backdrop(event: MouseEvent) {
  if (event.target !== dialog.value || !dialog.value) return
  const box = dialog.value.getBoundingClientRect()
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dismiss()
}
watch(() => props.open, async open => {
  await nextTick()
  if (!dialog.value) return
  if (open && !dialog.value.open) {
    notified = false
    previousOverflow = document.body.style.overflow
    dialog.value.showModal()
    document.body.style.overflow = 'hidden'
  } else if (!open && dialog.value.open) dismiss()
}, { immediate: true, flush: 'post' })
onBeforeUnmount(() => { notified = true; dialog.value?.close(); restoreScroll() })
</script>

<template>
  <dialog ref="dialog" class="dashboard-dialog" :aria-labelledby="labelledby" @close="closed" @cancel.prevent="dismiss" @click="backdrop" @keydown="trapFocus">
    <slot />
  </dialog>
</template>
