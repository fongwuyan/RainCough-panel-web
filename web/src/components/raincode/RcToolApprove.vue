<script setup>
import { ref, computed } from 'vue'

const props = defineProps({ pending: { type: Object, default: null } })
const emit = defineEmits(['decide'])

const reason = ref('')
const addWhitelist = ref(false)
const showExtra = ref(false)

const isShell = computed(() => (props.pending && props.pending.name) === 'execute_shell')
const command = computed(() => {
  if (isShell.value && props.pending && props.pending.args) {
    return String(props.pending.args.command || '')
  }
  return ''
})

function decide(approved) {
  emit('decide', { approved, reason: reason.value.trim(), addWhitelist: addWhitelist.value })
}
</script>

<template>
  <div class="mask" @click.self="showExtra = !showExtra">
    <div class="modal">
      <div class="m-title">需要确认</div>
      <div class="m-tool">工具: <b>{{ pending.name }}</b></div>
      <div v-if="isShell" class="m-cmd pre">{{ command }}</div>
      <div v-else class="m-args pre">{{ JSON.stringify(pending.args, null, 2) }}</div>
      <div class="m-extra" v-if="showExtra">
        <input v-model="reason" placeholder="备注(可选, 拒绝时可说明原因)" class="ipt" />
        <label class="wl" v-if="isShell">
          <input type="checkbox" v-model="addWhitelist" /> 允许后加入白名单
        </label>
      </div>
      <div class="btns">
        <button class="b allow" @click="decide(true)">允许</button>
        <button class="b deny" @click="decide(false)">拒绝</button>
        <button class="b ghost" @click="showExtra = !showExtra">选项</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}
.modal { width: min(520px, 90vw); background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
.m-title { font-weight: 700; color: var(--text); margin-bottom: 8px; }
.m-tool { font-size: 13px; color: var(--text); margin-bottom: 8px; }
.m-tool b { color: var(--accent); }
.m-cmd, .m-args {
  font-size: 12px; color: var(--text-muted); background: var(--panel, rgba(0,0,0,0.05));
  border-radius: 8px; padding: 10px; white-space: pre-wrap; max-height: 200px; overflow: auto;
  margin-bottom: 10px; border: 1px solid var(--border);
}
.ipt { width: 100%; box-sizing: border-box; padding: 8px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font-family: var(--font); margin-bottom: 8px; }
.wl { font-size: 12px; color: var(--text); display: flex; gap: 6px; align-items: center; }
.btns { display: flex; gap: 8px; margin-top: 14px; justify-content: flex-end; }
.b { padding: 8px 18px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-family: var(--font); }
.allow { background: var(--accent); color: #fff; }
.deny { background: #e05c5c; color: #fff; }
.ghost { background: transparent; border: 1px solid var(--border); color: var(--text); }
</style>