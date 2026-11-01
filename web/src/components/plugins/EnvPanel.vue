<template>
  <!-- 插件环境报告(只读)。P0 阶段只展示, 不提供修复按钮。 -->
  <div class="rcq-env">
    <div class="rcq-env-head">
      <span class="rcq-env-title">环境检查</span>
      <span v-if="report && report.ready" class="rcq-env-ok">就绪</span>
      <span v-else-if="report" class="rcq-env-warn">{{ report.pending }} 项待处理</span>
      <span class="rcq-env-meta mono" v-if="report && report.ms != null">{{ report.ms }}ms</span>
      <button class="btn btn-sm rcq-env-btn" :disabled="loading" @click="$emit('recheck')">
        {{ loading ? '检查中…' : '重新检查' }}
      </button>
    </div>

    <div v-if="error" class="rcq-env-empty">{{ error }}</div>
    <div v-else-if="!report" class="rcq-env-empty">{{ loading ? '正在检查环境…' : '暂无环境信息' }}</div>

    <template v-else>
      <div v-if="report.warn" class="rcq-env-note">{{ report.warn }}</div>

      <div v-if="!report.items || !report.items.length" class="rcq-env-empty">
        该插件未声明环境依赖
      </div>

      <div
        v-for="it in report.items"
        :key="it.id"
        class="rcq-env-row"
        :class="'is-' + it.status"
      >
        <span class="rcq-env-mark">{{ markOf(it.status) }}</span>
        <div class="rcq-env-body">
          <div class="rcq-env-name">
            {{ it.label || it.id }}
            <em v-if="!it.required" class="rcq-env-opt">可选</em>
          </div>
          <div v-if="it.detail" class="rcq-env-detail mono" :title="it.detail">{{ it.detail }}</div>
          <div v-if="it.hint" class="rcq-env-hint">{{ it.hint }}</div>
          <a v-if="it.guide" class="rcq-env-link" :href="it.guide" target="_blank" rel="noopener">查看安装指引 ↗</a>
        </div>

        <!-- 一键修复: 只在真的有 apply 步骤时才给按钮。
             没有步骤却渲染一个按钮 = 点了没反应 —— 比不给更让人火大。 -->
        <button
          v-if="canFix(it)"
          class="btn btn-sm rcq-env-fixbtn"
          @click="$emit('fix', it)"
        >一键修复</button>
        <span v-else-if="needRoot(it)" class="rcq-env-fix mono">面板非 root，无法自动执行</span>
        <span v-else class="rcq-env-fix mono">{{ fixText(it) }}</span>
      </div>

      <div class="rcq-env-foot">
        <span class="mono">{{ report.os }}/{{ report.arch }}</span>
        <span v-if="!report.root" class="rcq-env-rootless">面板非 root，需要 root 的项无法一键处理</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  report: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  // applyable: 是否提供"一键修复"。
  // 关着的时候面板纯只读 —— 装插件的浮窗与插件页共用这一个组件,
  // 由使用方决定要不要露出写操作的入口。
  applyable: { type: Boolean, default: false },
})
defineEmits(['recheck', 'fix'])

// canFix: 有可执行的 apply 步骤, 且当前面板有权限执行。
function canFix(it) {
  if (!props.applyable || !it) return false
  if (it.status === 'ok') return false
  if (!it.apply_steps || !it.apply_steps.length) return false
  if (it.fix === 'root' && !(props.report && props.report.root)) return false
  return it.fix === 'auto' || it.fix === 'root'
}

// needRoot: 需要 root 但面板不是 root —— 只能给命令让用户自己跑。
function needRoot(it) {
  if (!props.applyable || !it) return false
  if (it.status === 'ok') return false
  return it.fix === 'root' && !(props.report && props.report.root)
}

// 状态图标用字符而非 emoji: emoji 在部分 Linux 浏览器上会渲染成方块
function markOf(status) {
  switch (status) {
    case 'ok': return '✓'
    case 'missing': return '✕'
    case 'degraded': return '!'
    default: return '?'
  }
}

function fixText(it) {
  if (it.status === 'ok') return ''
  switch (it.fix) {
    case 'auto': return '可自动修复'
    case 'root': return props.report && props.report.root ? '需 root 执行' : '需 root'
    case 'manual': return '需手动处理'
    default: return ''
  }
}
</script>

<style scoped>
/* ★ 所有类名都带 rcq- 前缀: main.css 的 .error/.hint 带 24px padding 与居中,
   直接复用会把这里每一行撑成大块(接手文档"踩过的坑"第 7 条)。 */
.rcq-env {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-raised);
  padding: 10px 12px;
  margin: 8px 0;
  font-size: 12px;
}
.rcq-env-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.rcq-env-title { font-weight: 600; color: var(--text); }
.rcq-env-ok { color: var(--success); }
.rcq-env-warn { color: var(--warning); }
.rcq-env-meta { color: var(--text-faint); font-size: 11px; }
.rcq-env-btn { margin-left: auto; }

.rcq-env-note {
  color: var(--warning);
  background: var(--warning-soft);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  margin-bottom: 8px;
  line-height: 1.5;
}
.rcq-env-empty { color: var(--text-faint); padding: 6px 0; }

.rcq-env-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 7px 0;
  border-top: 1px solid var(--border);
}
.rcq-env-mark {
  width: 14px;
  flex: 0 0 14px;
  text-align: center;
  line-height: 1.5;
}
.rcq-env-row.is-ok .rcq-env-mark { color: var(--success); }
.rcq-env-row.is-missing .rcq-env-mark { color: var(--danger); }
.rcq-env-row.is-degraded .rcq-env-mark { color: var(--warning); }
.rcq-env-row.is-unknown .rcq-env-mark { color: var(--text-faint); }

.rcq-env-body { flex: 1; min-width: 0; }
.rcq-env-name { color: var(--text); }
.rcq-env-opt {
  color: var(--text-faint);
  font-style: normal;
  margin-left: 6px;
  font-size: 11px;
}
.rcq-env-detail,
.rcq-env-hint {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rcq-env-link { color: var(--accent); font-size: 11px; text-decoration: none; }
.rcq-env-link:hover { text-decoration: underline; }

.rcq-env-fix {
  flex: 0 0 auto;
  color: var(--text-faint);
  font-size: 11px;
  padding-top: 1px;
}
.rcq-env-fixbtn { flex: 0 0 auto; }

.rcq-env-foot {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  color: var(--text-faint);
  font-size: 11px;
}
.rcq-env-rootless { color: var(--warning); }
</style>
