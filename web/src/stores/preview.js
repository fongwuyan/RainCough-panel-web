import { ref, computed } from 'vue'

const show = ref(false)
const list = ref([])
const index = ref(0)

export function usePreview() {
  function open(items, start = 0) {
    list.value = Array.isArray(items) ? items : [items]
    index.value = Math.max(0, Math.min(start, list.value.length - 1))
    show.value = true
  }
  function close() {
    show.value = false
    list.value = []
    index.value = 0
  }
  function next() {
    if (list.value.length > 1) index.value = (index.value + 1) % list.value.length
  }
  function prev() {
    if (list.value.length > 1) index.value = (index.value - 1 + list.value.length) % list.value.length
  }
  return {
    show,
    index,
    current: computed(() => list.value[index.value]),
    count: computed(() => list.value.length),
    open,
    close,
    next,
    prev,
  }
}
