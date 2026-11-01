<template>
  <!-- 安装时间轴。
       未到达的阶段置灰但**显示**出来 —— 用户最烦的是盯着百分比猜还有几步。 -->
  <ol class="rcq-tl">
    <li
      v-for="p in phases"
      :key="p.key"
      class="rcq-tl-item"
      :class="'is-' + stateOf(p.key)"
    >
      <span class="rcq-tl-dot">{{ markOf(stateOf(p.key)) }}</span>
      <div class="rcq-tl-body">
        <div class="rcq-tl-label">{{ p.label }}</div>
        <div v-if="detailOf(p.key)" class="rcq-tl-detail" :title="detailOf(p.key)">
          {{ detailOf(p.key) }}
        </div>
      </div>
    </li>
  </ol>
</template>

<script setup>
import { computed } from 'vue'
import { INSTALL_PHASES } from './useInstallDock'

const props = defineProps({
  // steps: { key -> { state, detail } }
  steps: { type: Object, default: () => ({}) },
  phases: { type: Array, default: () => INSTALL_PHASES },
})

function stateOf(key) {
  const s = props.steps || {}
  const v = s[key]
  return (v && v.state) || 'wait'
}

function detailOf(key) {
  const s = props.steps || {}
  const v = s[key]
  return (v && v.detail) || ''
}

// 状态用字符而非 emoji: emoji 在部分 Linux 浏览器上会渲染成方块
function markOf(state) {
  switch (state) {
    case 'ok': return '✓'
    case 'fail': return '✕'
    case 'run': return '⟳'
    case 'skip': return '–'
    default: return '·'
  }
}
</script>

<style scoped>
.rcq-tl {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 12px;
}
.rcq-tl-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 5px 0;
  position: relative;
}
/* 竖线: 只连到倒数第二个, 最后一个不拖尾 */
.rcq-tl-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 20px;
  bottom: -2px;
  width: 1px;
  background: var(--border);
}
.rcq-tl-dot {
  width: 14px;
  flex: 0 0 14px;
  text-align: center;
  line-height: 1.4;
  color: var(--text-faint);
  z-index: 1;
  background: var(--bg-raised);
}
.rcq-tl-item.is-ok .rcq-tl-dot { color: var(--success); }
.rcq-tl-item.is-run .rcq-tl-dot { color: var(--warning); }
.rcq-tl-item.is-fail .rcq-tl-dot { color: var(--danger); }
.rcq-tl-item.is-wait .rcq-tl-label { color: var(--text-faint); }

.rcq-tl-body { flex: 1; min-width: 0; }
.rcq-tl-label { color: var(--text); }
.rcq-tl-item.is-wait .rcq-tl-label { color: var(--text-faint); }
.rcq-tl-item.is-skip .rcq-tl-label { color: var(--text-faint); }
.rcq-tl-detail {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
