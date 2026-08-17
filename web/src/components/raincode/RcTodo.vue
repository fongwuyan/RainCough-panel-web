<script setup>
import { computed } from 'vue'
const props = defineProps({ todos: { type: Array, default: () => [] } })
const done = computed(() => props.todos.filter((t) => t.done).length)
</script>

<template>
  <div class="todo">
    <div class="head">任务清单 <span class="count">{{ done }}/{{ todos.length }}</span></div>
    <div v-if="!todos.length" class="empty">暂无任务。让 AI 维护任务清单时会显示在这里。</div>
    <ul class="list">
      <li v-for="t in todos" :key="t.id" :class="{ done: t.done }">
        <span class="box">{{ t.done ? '✓' : '' }}</span>
        <span class="txt">{{ t.text }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.todo { display: flex; flex-direction: column; height: 100%; }
.head {
  padding: 10px 12px; font-weight: 700; color: var(--text); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
}
.count { font-size: 11px; font-weight: 400; color: var(--text-muted); }
.list { list-style: none; margin: 0; padding: 8px; overflow-y: auto; flex: 1; }
.list li { display: flex; gap: 8px; align-items: flex-start; padding: 6px 4px; }
.box {
  flex-shrink: 0; width: 16px; height: 16px; border: 1.5px solid var(--accent); border-radius: 4px;
  display: inline-flex; align-items: center; justify-content: center; font-size: 11px; color: #fff;
  background: transparent;
}
li.done .box { background: var(--accent); }
.txt { font-size: 13px; color: var(--text); }
li.done .txt { color: var(--text-muted); text-decoration: line-through; }
.empty { color: var(--text-muted); font-size: 12px; text-align: center; padding: 20px 8px; }
</style>