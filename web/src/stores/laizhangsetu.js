import { ref } from 'vue'
import { api } from '../api'

const tags = ref([])
const config = ref(null)

export function useLaizhangsetu() {
  async function loadConfig() {
    try {
      config.value = await api.lsConfig()
    } catch (e) {
      config.value = {}
    }
  }
  return { tags, config, loadConfig }
}
