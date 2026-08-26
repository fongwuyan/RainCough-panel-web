import { ref } from 'vue'
import { pluginsApi } from '../api/plugins'

// 插件注册表 store: 侧栏/搜索/远程组件加载共用。
const plugins = ref([])
const loaded = ref(false)

export function usePlugins() {
  async function load(force = false) {
    if (loaded.value && !force) return
    try {
      plugins.value = await pluginsApi.list()
      loaded.value = true
    } catch (e) {
      plugins.value = []
    }
  }
  function find(name) {
    return plugins.value.find((p) => p.name === name)
  }
  async function remove(name) {
    await pluginsApi.remove(name)
    await load(true)
  }
  return { plugins, loaded, load, find, remove }
}