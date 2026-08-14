import { ref } from 'vue'
import { api } from '../api'

const plugins = ref([])

export function usePlugins() {
  async function load() {
    try {
      plugins.value = await api.listPlugins()
    } catch (e) {
      plugins.value = []
    }
  }
  function find(name) {
    return plugins.value.find((p) => p.name === name)
  }
  async function remove(name) {
    await api.removePlugin(name)
    await load()
  }
  return { plugins, load, find, remove }
}
