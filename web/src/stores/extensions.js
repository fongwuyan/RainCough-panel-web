import { ref } from 'vue'
import { api } from '../api'

// 已装系统扩展(内置 7 项之外的功能包), 侧边栏与「系统扩展」页共用
const extensions = ref([])
const builtins = ref([])
const loaded = ref(false)

export function useExtensions() {
  async function load() {
    try {
      const d = await api.extList()
      extensions.value = d.extensions || []
      builtins.value = d.builtin || []
    } catch (e) {
      extensions.value = []
    } finally {
      loaded.value = true
    }
  }
  function find(name) {
    return extensions.value.find((x) => x.name === name)
  }
  return { extensions, builtins, loaded, load, find }
}
