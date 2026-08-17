<script setup>
import { ref, nextTick, watch } from 'vue'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  streaming: { type: Boolean, default: false },
  thinking: { type: Boolean, default: false },
  bootMsg: { type: String, default: '' },
})
const emit = defineEmits(['send', 'cancel'])

const input = ref('')
const scroll = ref(null)

watch(() => props.messages, async () => {
  await nextTick()
  if (scroll.value) scroll.value.scrollTop = scroll.value.scrollHeight
}, { deep: true })

function submit() {
  const t = input.value.trim()
  if (!t || props.streaming) return
  emit('send', t)
  input.value = ''
}
function onKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}
</script>

<template>
  <div class="chat">
    <div ref="scroll" class="msgs">
      <div v-if="bootMsg && !messages.length" class="boot">{{ bootMsg }}</div>
      <template v-if="!messages.length">
        <div class="empty">开始新的对话。你可以让我读/写文件、执行命令、写代码。</div>
      </template>
      <div v-for="(m, i) in messages" :key="i" class="msg-row" :class="m.role">
        <div class="who">{{ m.role === 'user' ? '你' : 'AI' }}</div>
        <div class="bubble">
          <div v-if="m.role === 'user' || m.role === 'tool'" class="text pre">{{ m.content }}</div>
          <template v-else>
            <div class="text pre" :class="{ err: m.error }">{{ m.content }}</div>
            <div v-for="(t, ti) in m.tools" :key="ti" class="tool">
              <div class="t-head">
                <span class="t-name">{{ t.name }}</span>
                <span v-if="t.running" class="t-state run">运行中…</span>
                <span v-else class="t-state done">完成</span>
              </div>
              <div v-if="t.args" class="t-args pre">{{ JSON.stringify(t.args, null, 2) }}</div>
              <div v-if="t.output" class="t-out pre">{{ t.output }}</div>
            </div>
          </template>
        </div>
      </div>
      <div v-if="streaming && thinking" class="thinking">思考中…</div>
    </div>
    <div class="composer">
      <textarea
        v-model="input"
        rows="2"
        placeholder="输入消息, Enter 发送 / Shift+Enter 换行"
        :disabled="streaming"
        @keydown="onKey"
      ></textarea>
      <button v-if="streaming" class="send stop" @click="emit('cancel')">停止</button>
      <button v-else class="send" :disabled="!input.trim()" @click="submit">发送</button>
    </div>
  </div>
</template>

<style scoped>
.chat { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.msgs { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.empty { color: var(--text-muted); font-size: 13px; text-align: center; margin-top: 40px; }
.boot { color: #e0a000; font-size: 13px; text-align: center; }
.msg-row { display: flex; gap: 8px; max-width: 100%; }
.msg-row.user { flex-direction: row-reverse; }
.who {
  flex-shrink: 0; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center;
  justify-content: center; font-size: 12px; font-weight: 700; background: var(--accent); color: #fff;
}
.msg-row.user .who { background: var(--border); color: var(--text); }
.bubble {
  max-width: 82%; background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 10px 12px; overflow-wrap: anywhere;
}
.msg-row.user .bubble { background: var(--accent); color: #fff; border-color: transparent; }
.text { font-size: 13px; line-height: 1.6; }
.pre { white-space: pre-wrap; }
.err { color: #e05c5c; }
.tool { margin-top: 8px; border: 1px solid var(--border); border-radius: 8px; padding: 8px; background: var(--bg); }
.t-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.t-name { font-weight: 700; font-size: 12px; color: var(--accent); }
.t-state { font-size: 11px; padding: 1px 8px; border-radius: 999px; }
.t-state.run { background: #fff3cd; color: #7a5a00; }
.t-state.done { background: #e6f4ea; color: #1a7f37; }
.t-args, .t-out {
  font-size: 12px; color: var(--text-muted); background: var(--panel, rgba(0,0,0,0.04));
  border-radius: 6px; padding: 6px; white-space: pre-wrap; max-height: 200px; overflow: auto;
}
.thinking { color: var(--text-muted); font-size: 12px; font-style: italic; }
.composer { display: flex; gap: 8px; padding: 12px; border-top: 1px solid var(--border); }
.composer textarea {
  flex: 1; resize: none; padding: 10px; border-radius: 10px; border: 1px solid var(--border);
  background: var(--surface); color: var(--text); font-family: var(--font); font-size: 13px;
}
.send {
  align-self: flex-end; padding: 10px 18px; border: none; border-radius: 10px; background: var(--accent);
  color: #fff; font-weight: 600; cursor: pointer; font-family: var(--font);
}
.send:disabled { opacity: 0.5; cursor: not-allowed; }
.send.stop { background: #e05c5c; }
</style>