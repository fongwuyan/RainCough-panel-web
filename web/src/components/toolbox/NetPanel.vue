<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

// search
const q = ref('')
const searchLoading = ref(false)
const searchError = ref('')
const results = ref(null)

// rss
const feeds = ref([])
const rssUrl = ref('')
const rssName = ref('')
const rssLoading = ref(false)
const rssError = ref('')
const entries = ref(null)
const fetchingUrl = ref('')

// urlcheck
const urlText = ref('')
const checkLoading = ref(false)
const checkError = ref('')
const checkResults = ref(null)

// readability
const rdUrl = ref('')
const rdLoading = ref(false)
const rdError = ref('')
const rdResult = ref(null)

onMounted(loadFeeds)

async function loadFeeds() {
  try { feeds.value = (await api.tbRssList()).feeds } catch (e) { /* ignore */ }
}

async function doSearch() {
  if (!q.value.trim()) { searchError.value = '请输入关键词'; return }
  searchLoading.value = true; searchError.value = ''; results.value = null
  try { results.value = await api.tbSearch(q.value.trim()) }
  catch (e) { searchError.value = e.message }
  finally { searchLoading.value = false }
}

async function addFeed() {
  if (!rssUrl.value.trim()) { rssError.value = '请输入 RSS 地址'; return }
  rssLoading.value = true; rssError.value = ''
  try {
    const r = await api.tbRssAdd(rssUrl.value.trim(), rssName.value.trim())
    feeds.value = r.feeds
    rssUrl.value = ''; rssName.value = ''
  } catch (e) { rssError.value = e.message }
  finally { rssLoading.value = false }
}

async function delFeed(idx) {
  try {
    const r = await api.tbRssDelete(idx)
    feeds.value = r.feeds
  } catch (e) { rssError.value = e.message }
}

async function fetchFeed(url) {
  fetchingUrl.value = url; rssError.value = ''; entries.value = null
  try { entries.value = await api.tbRssFetch(url) }
  catch (e) { rssError.value = e.message }
  finally { fetchingUrl.value = '' }
}

async function doCheck() {
  const urls = urlText.value.split(/\n|,|;/).map(s => s.trim()).filter(Boolean)
  if (!urls.length) { checkError.value = '请输入 URL，每行一个'; return }
  checkLoading.value = true; checkError.value = ''; checkResults.value = null
  try { checkResults.value = await api.tbUrlCheck(urls) }
  catch (e) { checkError.value = e.message }
  finally { checkLoading.value = false }
}

async function doRead() {
  if (!rdUrl.value.trim()) { rdError.value = '请输入网页地址'; return }
  rdLoading.value = true; rdError.value = ''; rdResult.value = null
  try { rdResult.value = await api.tbReadability(rdUrl.value.trim()) }
  catch (e) { rdError.value = e.message }
  finally { rdLoading.value = false }
}
</script>

<template>
  <div class="section">
    <div class="section-title">网页搜索</div>
    <div class="search-bar" style="align-items:stretch;">
      <input v-model="q" class="input" style="flex:1;" placeholder="输入关键词（Bing 搜索）" @keyup.enter="doSearch" />
      <button class="btn btn-primary" :disabled="searchLoading" @click="doSearch">
        {{ searchLoading ? '搜索中...' : '搜索' }}
      </button>
    </div>
    <div v-if="searchError" class="error" style="margin-top:10px;">{{ searchError }}</div>
    <div v-if="searchLoading" class="loading" style="margin-top:10px;"><div class="spinner"></div></div>
    <div v-else-if="results && results.ok" style="margin-top:12px;">
      <div v-for="(r, i) in results.results" :key="i" class="result-item" style="cursor:default;" @click.stop>
        <a :href="r.url" target="_blank" rel="noopener" class="name" style="color:var(--accent);">{{ r.title }}</a>
        <div class="meta">{{ r.url }}</div>
        <div class="note">{{ r.snippet }}</div>
      </div>
      <div v-if="!results.results.length" class="hint">无结果</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">RSS 订阅聚合</div>
    <div class="search-bar" style="align-items:stretch;">
      <input v-model="rssUrl" class="input" style="flex:1;" placeholder="RSS 地址，如 https://www.ithome.com/rss/" />
      <input v-model="rssName" class="input" style="width:150px;" placeholder="名称(可选)" />
      <button class="btn btn-primary" :disabled="rssLoading" @click="addFeed">
        {{ rssLoading ? '添加中...' : '添加订阅' }}
      </button>
    </div>
    <div v-if="rssError" class="error" style="margin-top:10px;">{{ rssError }}</div>

    <div v-if="feeds.length" style="margin-top:14px;">
      <div v-for="(f, i) in feeds" :key="i" class="result-item" style="cursor:default;" @click.stop>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div>
            <div class="name" style="font-size:13px;">{{ f.name }}</div>
            <div class="meta" style="font-size:11px;">{{ f.url }}<span v-if="f.last_fetched"> · {{ new Date(f.last_fetched * 1000).toLocaleString() }}</span></div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;">
            <button class="btn btn-sm" :disabled="fetchingUrl === f.url" @click="fetchFeed(f.url)">
              {{ fetchingUrl === f.url ? '抓取中...' : '刷新' }}
            </button>
            <button class="btn btn-sm btn-danger" @click="delFeed(i)">删除</button>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="hint" style="margin-top:10px;">还没有订阅源</div>

    <div v-if="entries" style="margin-top:16px;">
      <div class="section-title" style="margin-top:16px;">{{ entries.feed_title }}</div>
      <div v-for="(e, i) in entries.entries" :key="i" class="result-item" style="cursor:default;" @click.stop>
        <a :href="e.link" target="_blank" rel="noopener" class="name" style="color:var(--accent);font-size:13px;">{{ e.title }}</a>
        <div class="meta">{{ new Date(e.published_ts * 1000).toLocaleString() }}</div>
        <div class="note">{{ e.summary }}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">站点可达性检测</div>
    <textarea v-model="urlText" class="input" style="width:100%;min-height:70px;font-family:var(--font-mono);font-size:12px;"
      placeholder="每行一个 URL"></textarea>
    <div style="margin-top:10px;">
      <button class="btn btn-primary" :disabled="checkLoading" @click="doCheck">
        {{ checkLoading ? '检测中...' : '检测' }}
      </button>
    </div>
    <div v-if="checkError" class="error" style="margin-top:10px;">{{ checkError }}</div>
    <div v-if="checkLoading" class="loading" style="margin-top:10px;"><div class="spinner"></div></div>
    <div v-else-if="checkResults" style="margin-top:12px;">
      <div v-for="(r, i) in checkResults.results" :key="i" class="mono-block" style="margin-bottom:8px;display:flex;justify-content:space-between;gap:10px;">
        <span style="word-break:break-all;flex:1;">{{ r.url }}</span>
        <span :class="r.ok ? 'ok' : 'fail'" style="flex-shrink:0;">
          {{ r.status || 'ERR' }} · {{ r.ms }}ms
        </span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">网页正文提取</div>
    <div class="search-bar" style="align-items:stretch;">
      <input v-model="rdUrl" class="input" style="flex:1;" placeholder="网页地址" @keyup.enter="doRead" />
      <button class="btn btn-primary" :disabled="rdLoading" @click="doRead">
        {{ rdLoading ? '提取中...' : '提取' }}
      </button>
    </div>
    <div v-if="rdError" class="error" style="margin-top:10px;">{{ rdError }}</div>
    <div v-if="rdLoading" class="loading" style="margin-top:10px;"><div class="spinner"></div></div>
    <div v-else-if="rdResult" style="margin-top:12px;">
      <div class="section-title" style="margin-top:12px;">{{ rdResult.title }}</div>
      <textarea class="input" style="width:100%;min-height:200px;font-family:var(--font-mono);font-size:12px;"
        :value="rdResult.text" readonly></textarea>
      <div style="margin-top:10px;">
        <a class="btn btn-ghost" :href="'data:text/plain;charset=utf-8,' + encodeURIComponent(rdResult.text)" download="extract.txt">下载 .txt</a>
      </div>
    </div>
  </div>
</template>
