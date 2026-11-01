<template>
  <!-- 执行前的命令确认遮罩。
       ★ 命令原文完整摊开: 不折叠、不省略、不搞"展开查看详情"。
         这是整套安全模型里唯一真正起作用的一环 —— 用户能一眼看见 rm -rf。
         横向滚动而不是折行: 折行会让人读错命令。 -->
  <Teleport to="body">
    <div v-if="box" class="rcq-mask" @click.self="cancel">
      <div class="rcq-sheet" role="dialog" aria-modal="true">
        <div class="rcq-sheet-head">
          <span class="rcq-sheet-title">确认执行环境准备</span>
          <button class="rcq-sheet-x" :disabled="box.running" @click="cancel" title="关闭">×</button>
        </div>

        <div class="rcq-sheet-body">
          <p class="rcq-sheet-lead">
            以下命令将以面板当前权限
            <b>{{ rootText }}</b>
            执行，确认后立即运行：
          </p>

          <div v-for="s in box.steps" :key="s.id" class="rcq-sheet-step">
            <div class="rcq-sheet-label">
              {{ s.label || s.id }}
              <span v-if="s.needs === 'root'" class="rcq-sheet-tag">需 root</span>
            </div>
            <pre class="rcq-sheet-cmd mono">{{ s.command }}</pre>
          </div>

          <label class="rcq-sheet-check">
            <input type="checkbox" v-model="box.checked" :disabled="box.running" />
            <span>我已确认上述命令，可以执行</span>
          </label>

          <p v-if="box.error" class="rcq-sheet-err">{{ box.error }}</p>
        </div>

        <div class="rcq-sheet-foot">
          <button class="btn" :disabled="box.running" @click="cancel">取消</button>
          <button
            class="btn btn-primary"
            :disabled="!box.checked || box.running"
            @click="run"
          >{{ box.running ? '执行中…' : '执行' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import { useInstallDock } from './useInstallDock'

const dock = useInstallDock()
const box = computed(() => dock.confirmBox.value)
const rootText = computed(() => (box.value && box.value.root ? 'root' : '普通用户'))

function cancel() {
  dock.cancelConfirm()
}
function run() {
  dock.runConfirm()
}
</script>

<style scoped>
.rcq-mask {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.rcq-sheet {
  width: 520px;
  max-width: 100%;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  color: var(--text);
}
.rcq-sheet-head {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}
.rcq-sheet-title { font-weight: 600; font-size: 13px; }
.rcq-sheet-x {
  margin-left: auto;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}
.rcq-sheet-x:hover { background: var(--surface-2); color: var(--text); }

.rcq-sheet-body { padding: 12px; overflow: auto; }
.rcq-sheet-lead { margin: 0 0 10px; font-size: 12px; color: var(--text-muted); line-height: 1.6; }
.rcq-sheet-step { margin-bottom: 10px; }
.rcq-sheet-label {
  font-size: 12px;
  color: var(--text);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.rcq-sheet-tag {
  font-size: 10px;
  color: var(--warning);
  border: 1px solid var(--warning);
  border-radius: var(--radius-pill);
  padding: 0 6px;
}
/* 命令原文: 横向滚动, 不折行 —— 折行会让人读错命令 */
.rcq-sheet-cmd {
  margin: 0;
  padding: 8px 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: 11px;
  line-height: 1.6;
  white-space: pre;
  overflow-x: auto;
  max-height: 220px;
  overflow-y: auto;
}
.rcq-sheet-check {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--text);
  cursor: pointer;
}
.rcq-sheet-err {
  margin: 8px 0 0;
  color: var(--danger);
  font-size: 12px;
  line-height: 1.6;
}
.rcq-sheet-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--border);
}
</style>
