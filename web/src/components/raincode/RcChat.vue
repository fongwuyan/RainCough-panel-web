<script setup>
import { ref, nextTick, watch, computed } from 'vue'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  thinking: { type: Boolean, default: false },
  bootMsg: { type: String, default: '' },
})

const scroll = ref(null)

watch(() => props.messages, async () => {
  await nextTick()
  if (scroll.value) scroll.value.scrollTop = scroll.value.scrollHeight
}, { deep: true })

const hasMessages = computed(() => props.messages.length > 0)
</script>

<template>
  <div class="msgs" ref="scroll">
    <div v-if="!hasMessages" class="welcome">
      <div v-if="bootMsg" class="boot">{{ bootMsg }}</div>
      <div v-else class="empty">
        从一个简单的提示开始。构建模式可编辑文件并执行命令，规划模式只读分析。
      </div>
    </div>

    <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
      <template v-if="m.role === 'user'">
        <div class="user-block">
          <div class="user-text pre">{{ m.content }}</div>
        </div>
      </template>
      <template v-else>
        <!-- 助手消息 -->
        <div v-if="m.tools && m.tools.length" class="tools">
          <div v-for="(t, ti) in m.tools" :key="ti" class="tool">
            <div class="tool-head">
              <span class="tool-name">{{ t.name }}</span>
              <span class="tool-state" :class="{ run: t.running }">
                {{ t.running ? '…' : '✓' }}
              </span>
            </div>
            <div v-if="t.args" class="tool-args pre">{{ JSON.stringify(t.args) }}</div>
            <div v-if="t.output" class="tool-out pre">{{ t.output }}</div>
          </div>
        </div>
        <div v-if="m.content" class="assistant-text pre">{{ m.content }}</div>
      </template>
    </div>

    <div v-if="thinking" class="thinking-row">思考中…</div>
  </div>
</template>

<style scoped>
.msgs { flex: 1; overflow-y: auto; padding: 16px 8px; min-height: 0; }
.welcome { text-align: center; margin-top: 30px; }
.empty, .boot { color: var(--text-muted); font-size: 13px; }
.boot { color: var(--primary); }

.msg { margin-bottom: 2px; }

/* 用户消息: opencode 左侧色条 */
.user-block { border-left: 3px solid var(--secondary); background: var(--backgroundPanel); padding: 10px 14px; border-radius: 0 6px 6px 0; }
.user-text { color: var(--text); font-size: 14px; line-height: 1.6; }

/* 工具步骤 */
.tools { border-left: 3px solid var(--border); background: var(--backgroundPanel); margin-top: 6px; padding: 6px 12px; border-radius: 0 6px 6px 0; }
.tool { padding: 3px 0; }
.tool-head { display: flex; align-items: center; gap: 6px; }
.tool-name { font-weight: 700; font-size: 12px; color: var(--primary); }
.tool-state { color: var(--success); font-size: 12px; }
.tool-state.run { color: var(--warning); }
.tool-args, .tool-out {
  font-size: 12px; color: var(--text-muted); white-space: pre-wrap; margin: 4px 0 0 12px;
  max-height: 220px; overflow: auto;
}

/* 助手文本 */
.assistant-text {
  border-left: 3px solid var(--secondary); background: var(--backgroundPanel);
  padding: 10px 14px; color: var(--text); font-size: 14px; line-height: 1.65;
  margin-top: 2px; border-radius: 0 6px 6px 0;
}

.thinking-row { color: var(--text-muted); font-size: 12px; font-style: italic; padding: 10px 14px; }
.pre { white-space: pre-wrap; word-break: break-word; }
</style>