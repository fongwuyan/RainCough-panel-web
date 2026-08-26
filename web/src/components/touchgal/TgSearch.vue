<script setup>
import { ref } from 'vue'
import { api } from '../../api'
import TgResourceModal from './TgResourceModal.vue'

const LIMIT_KEY = 'touchgal_limit'
const NSFW_KEY = 'touchgal_nsfw'

const keyword = ref('')
const loading = ref(false)
const error = ref('')
const result = ref(null)
const lastKeyword = ref('')
const showResource = ref(false)
const resourceId = ref('')

async function doSearch() {
  const kw = keyword.value.trim()
  if (!kw) return
  loading.value = true
  error.value = ''
  result.value = null
  try {
    result.value = await api.tgSearch(
      kw,
      parseInt(localStorage.getItem(LIMIT_KEY) || '15'),
      localStorage.getItem(NSFW_KEY) === 'true'
    )
    lastKeyword.value = kw
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function openResource(id) {
  resourceId.value = id
  showResource.value = true
}

function fmtTags(tags) {
  if (!tags) return ''
  const arr = Array.isArray(tags) ? tags.join(', ') : tags
  return arr.length > 30 ? arr.substring(0, 30) + '...' : arr
}

const games = () => (result.value && result.value.galgames) || []
</script>

<template>
  <div>
    <div class="search-bar">
      <input v-model="keyword" class="input" type="text" placeholder="输入游戏关键词（如：千恋万花）" @keydown.enter="doSearch" />
      <button class="btn btn-primary" :disabled="loading" @click="doSearch">{{ loading ? '搜索中...' : '搜索' }}</button>
    </div>

    <div v-if="loading" class="loading"><div class="spinner"></div>正在搜索中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else-if="result">
      <div v-if="!games().length" class="error">未找到游戏: {{ lastKeyword }}</div>
      <template v-else>
        <div class="status-line" style="margin-bottom:12px;">找到 {{ games().length }} 个相关游戏：</div>
        <div v-for="(game, i) in games()" :key="game.id" class="result-item" @click="openResource(game.id)">
          <div class="name">{{ i + 1 }}. {{ game.name }}</div>
          <div class="meta">
            ID: {{ game.id }} | {{ game.platform ? (Array.isArray(game.platform) ? game.platform.join(', ') : game.platform) : '未知平台' }}
            | {{ game.language ? (Array.isArray(game.language) ? game.language.join(', ') : game.language) : '未知语言' }}
          </div>
          <div v-if="fmtTags(game.tags)" class="note">标签: {{ fmtTags(game.tags) }}</div>
        </div>
        <div class="status-line" style="text-align:center;margin-top:10px;">点击游戏卡片查看下载资源 | 数据来源: Touchgal API</div>
      </template>
    </template>

    <TgResourceModal v-if="showResource" :patch-id="resourceId" @close="showResource = false" />
  </div>
</template>
