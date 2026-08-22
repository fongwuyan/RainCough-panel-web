<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  value: { type: String, default: '' },
  mode: { type: String, default: 'build' },
  modelLabel: { type: String, default: '' },
  provider: { type: String, default: '' },
  providers: { type: Array, default: () => [] },
  models: { type: Array, default: () => [] },
  streaming: { type: Boolean, default: false },
  dir: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  center: { type: Boolean, default: false },
})
const emit = defineEmits([
  'update:value', 'update:mode', 'update:provider', 'update:model',
  'submit', 'interrupt', 'open-sessions', 'open-settings',
])

const ta = ref(null)
const focused = ref(false)

const providerSel = ref(props.provider)
watch(() => props.provider, (v) => { providerSel.value = v })

function onProvider() {
  emit('update:provider', providerSel.value)
}

const focusClass = computed(() => ({
  'focused': focused.value,
  'plan': props.mode === 'plan',
}))

function onKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    emit('submit')
  }
}
</script>

<template>
  <div
    class="prompt"
    :class="{ center, ...focusClass }"
    @mouseenter="focused = true"
    @mouseleave="focused = false"
  >
    <div class="frame">
      <textarea
        ref="ta"
        :value="value"
        :placeholder="placeholder"
        rows="2"
        @input="emit('update:value', $event.target.value)"
        @keydown="onKey"
      ></textarea>
      <div class="meta">
        <span class="meta-left">
          <button class="mode-label" :class="{ on: mode }" @click="emit('update:mode', mode === 'build' ? 'plan' : 'build')">
            {{ mode === 'build' ? '构建' : '规划' }}
          </button>
          <span class="dot">·</span>
          <select v-if="providers.length" class="pick" v-model="providerSel" @change="onProvider">
            <option v-for="p in providers" :key="p.name" :value="p.name" :disabled="!p.enabled">{{ p.name }}</option>
          </select>
          <select v-if="models.length" class="pick" :value="modelLabel" @change="emit('update:model', $event.target.value)">
            <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
            <option v-if="modelLabel && !models.includes(modelLabel)" :value="modelLabel">{{ modelLabel }}</option>
          </select>
          <span class="model-txt" v-if="modelLabel">{{ modelLabel }}</span>
        </span>
        <span class="meta-right">
          <button class="act-btn" title="切换会话" @click="emit('open-sessions')">会话</button>
          <button class="act-btn" title="设置" @click="emit('open-settings')">设置</button>
        </span>
      </div>
      <div class="status">
        <span v-if="streaming" class="st-left live">
          <span class="spin">⣾</span>
          <button class="interrupt" @click="emit('interrupt')">ESC 中断</button>
        </span>
        <span v-else class="st-left">{{ dir }}</span>
        <span class="st-right">
          <template v-if="streaming">
            <span class="shortcut">运行中…</span>
          </template>
          <template v-else>
            <span class="shortcut">⏎ 发送 · Shift⏎ 换行</span>
          </template>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prompt { width: 100%; display: flex; justify-content: center; padding: 0 16px; }
.frame {
  width: 100%; max-width: 1100px; display: flex; flex-direction: column; gap: 8px;
  border-left: 3px solid var(--prompt-border, var(--secondary)); border-radius: 0 8px 8px 0;
  background: var(--backgroundElement); padding: 12px 14px; box-sizing: border-box;
  box-shadow: 0 2px 12px rgba(0,0,0,0.35);
}
.prompt.focused .frame { border-left-color: var(--prompt-active, var(--primary)); }
.frame.plan { border-left-color: var(--prompt-plan, var(--accent)); }
textarea {
  width: 100%; box-sizing: border-box; resize: none; border: none; outline: none;
  background: transparent; color: var(--text); font-family: var(--font); font-size: 14px;
  line-height: 1.6; min-height: 44px;
}
textarea::placeholder { color: var(--text-muted); }
.meta { display: flex; align-items: center; justify-content: space-between; }
.meta-left { display: flex; align-items: center; gap: 6px; min-width: 0; }
.mode-label {
  border: none; background: transparent; color: var(--primary); font-weight: 700;
  font-size: 13px; cursor: pointer; padding: 0; font-family: var(--font); text-transform: capitalize;
}
.mode-label.on.plan { color: var(--accent); }
.dot { color: var(--text-muted); }
.model-txt { color: var(--text-muted); font-size: 12px; white-space: nowrap; }
.pick {
  background: var(--backgroundElement); color: var(--text); border: 1px solid var(--border);
  font-size: 12px; padding: 2px 4px; border-radius: 6px; font-family: var(--font);
}
.meta-right { display: flex; gap: 6px; }
.act-btn {
  border: 1px solid var(--border); background: transparent; color: var(--text-muted);
  font-size: 11px; padding: 2px 8px; border-radius: 6px; cursor: pointer; font-family: var(--font);
}
.act-btn:hover { color: var(--text); border-color: var(--borderActive); }
.status { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.st-left { color: var(--text-muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.st-left.live { display: flex; align-items: center; gap: 8px; }
.spin { color: var(--primary); animation: spin 1s steps(8) infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }
.interrupt { border: none; background: transparent; color: var(--text); font-size: 12px; cursor: pointer; font-family: var(--font); }
.st-right { color: var(--text-muted); font-size: 11px; white-space: nowrap; }
</style>