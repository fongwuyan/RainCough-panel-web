<script setup>
defineProps({
  sessions: { type: Array, default: () => [] },
  currentId: { type: String, default: '' },
  streaming: { type: Boolean, default: false },
})
const emit = defineEmits(['new', 'select', 'delete'])
</script>

<template>
  <div class="side">
    <div class="head">
      <span>会话</span>
      <button class="new" @click="emit('new')">+ 新会话</button>
    </div>
    <div class="list">
      <div v-if="!sessions.length" class="empty">暂无历史会话</div>
      <div
        v-for="s in sessions"
        :key="s.id"
        class="item"
        :class="{ active: s.id === currentId }"
        @click="emit('select', s.id)"
      >
        <div class="title">{{ s.title }}</div>
        <div class="meta">
          {{ new Date(s.updated || 0).toLocaleString() }}
          <span v-if="s.pending" class="pend">待审批</span>
        </div>
        <button class="del" title="删除" @click.stop="emit('delete', s.id)">✕</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.side { display: flex; flex-direction: column; height: 100%; }
.head {
  display: flex; align-items: center; justify-content: space-between; padding: 10px 12px;
  font-weight: 700; color: var(--text); border-bottom: 1px solid var(--border);
}
.new {
  font-size: 12px; padding: 4px 10px; border-radius: 8px; border: 1px solid var(--accent);
  background: transparent; color: var(--accent); cursor: pointer; font-family: var(--font);
}
.list { flex: 1; overflow-y: auto; padding: 6px; }
.item {
  position: relative; padding: 10px 28px 10px 10px; border-radius: 8px; cursor: pointer;
  margin-bottom: 4px; border: 1px solid transparent;
}
.item:hover { background: var(--panel, rgba(0,0,0,0.04)); }
.item.active { background: var(--accent); color: #fff; border-color: transparent; }
.title { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.item.active .meta { color: rgba(255,255,255,0.75); }
.pend { display: inline-block; margin-left: 6px; background: #fff3cd; color: #7a5a00; border-radius: 4px; padding: 0 5px; }
.del {
  position: absolute; top: 8px; right: 8px; border: none; background: transparent; color: inherit;
  cursor: pointer; opacity: 0; font-size: 12px;
}
.item:hover .del { opacity: 0.7; }
.item.active .del { opacity: 0.7; }
.empty { color: var(--text-muted); font-size: 12px; text-align: center; padding: 20px 0; }
</style>