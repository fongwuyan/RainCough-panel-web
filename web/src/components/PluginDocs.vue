<script setup>
import { ref } from 'vue'
import { DOC } from './docsData.js'

const active = ref(0)
function setDoc(i) { active.value = i }
const chapters = DOC
</script>

<template>
  <div>
    <div class="parent-tabs">
      <div class="pt item active"><span class="pt-badge"></span><b>开发文档</b>
        <span class="faint" style="font-size:12px">插件与系统功能编写指南 · 点击章节切换</span></div>
    </div>
    <div class="sub-tabs">
      <button v-for="(c, i) in chapters" :key="i" class="tab" :class="{ active: active === i }" @click="setDoc(i)">{{ c.label }}</button>
    </div>
    <div class="sf-body">
      <div v-for="(c, ci) in chapters" :key="ci">
        <div v-if="active === ci" class="doc-section">
          <template v-for="(it, ii) in c.items" :key="ii">
            <h3 v-if="it.t === 'h'">{{ it.x }}</h3>
            <p v-else-if="it.t === 'p'">{{ it.x }}</p>
            <ul v-else-if="it.t === 'ul'"><li v-for="(l, li) in it.x" :key="li">{{ l }}</li></ul>
            <ol v-else-if="it.t === 'ol'"><li v-for="(l, li) in it.x" :key="li">{{ l }}</li></ol>
            <pre v-else-if="it.t === 'pre'"><code>{{ it.x }}</code></pre>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.parent-tabs { display: flex; gap: 8px; margin-bottom: 14px; }
.pt { display: flex; align-items: center; gap: 10px; padding: 14px 18px; background: var(--accent-soft); border: 1px solid var(--border-strong); }
.pt-badge { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
.sub-tabs { display: flex; flex-wrap: wrap; gap: 2px; border-bottom: 1px solid var(--border); margin-bottom: 16px; }
.tab { padding: 9px 16px; font-size: 13px; font-weight: 600; color: var(--text-muted); background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; }
.tab:hover { color: var(--text); background: var(--surface-2); }
.tab.active { border-bottom-color: var(--accent); color: var(--accent); background: var(--accent-soft); }
.doc-section { background: var(--surface); border: 1px solid var(--border); padding: 20px; }
.doc-section h3 { font-size: 14px; font-weight: 700; margin: 20px 0 10px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
.doc-section h3:first-child { margin-top: 0; }
.doc-section p { margin: 8px 0; color: var(--text-muted); }
.doc-section ul, .doc-section ol { margin: 8px 0 8px 22px; color: var(--text-muted); }
.doc-section li { margin: 4px 0; }
.doc-section pre { background: var(--bg); border: 1px solid var(--border); padding: 14px; overflow-x: auto; margin: 10px 0; }
.doc-section pre code { font-family: var(--font-mono); font-size: 12px; color: var(--text); line-height: 1.7; white-space: pre-wrap; }
</style>
