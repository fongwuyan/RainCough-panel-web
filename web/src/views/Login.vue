<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '../api'
import { useAuth } from '../stores/auth'

// 登录页:
//   · 单密码输入框(防止撞库, 不区分 SSH/admin 通道)
//   · 自动聚焦、自动提交(回车)
//   · 错密码 → 500ms 防爆破期间显示「验证中…」而非「密码错误」(避免泄露计时)
//   · 登录成功 → 跳回登录前页面 (来源 hash) 或工作台
//
// 设计要点:
//   · 不显示用户名/邮箱等可枚举字段(本面板只有一种「管理员」, 没区分)
//   · 不显示「记住我」复选框(session 默认 30 天, 已是"永久保留"语义)
//   · 失败时不抖动/不弹窗, 仅输入框红框 + 错误文字, 防止注意力过度吸引
const router = useRouter()
const route = useRoute()
const auth = useAuth()

const pw = ref('')
const busy = ref(false)
const err = ref('')
const status = ref(null)   // 后端 status 完整对象(给提示用)
const inputRef = ref(null)

const isAuthed = computed(() => !!(status.value && status.value.logged_in))
const showSSHHint = computed(() => !!(status.value && status.value.can_ssh_password))
const sshUser = computed(() => (status.value && status.value.ssh_username) || '')
const shadowNote = computed(() => {
  const s = status.value
  if (!s || s.can_ssh_password) return ''
  return s.shadow_note || ''
})
const adminKind = computed(() => (status.value && status.value.admin_kind) || '')

// 已经登录 → 直接回原页
onMounted(async () => {
  try {
    const r = await api.authStatus()
    status.value = r
    if (r.logged_in) {
      router.replace(redirectTarget())
    }
  } catch (e) {
    status.value = { logged_in: false, has_admin_pw: true, can_ssh_password: false }
  }
  setTimeout(() => { try { inputRef.value && inputRef.value.focus() } catch (e) {} }, 50)
})

function redirectTarget() {
  // 登录前页面是 /login 或空 → 工作台; 否则跳回去。
  // 注意: next 里可能带着历史上的 /login(旧版 main.js 会叠加), 必须剔除, 否则登录后自己跳自己。
  let back = (route.query && route.query.next) || '/'
  if (typeof back !== 'string' || !back.startsWith('/') || back.indexOf('/login') === 0) back = '/'
  // 二次防御: 只取第一段 path(去掉自己嵌套的 next 查询串)
  const q = back.indexOf('?next=')
  if (q >= 0) back = back.slice(0, q)
  return back || '/'
}

async function submit() {
  if (busy.value) return
  if (!pw.value) { err.value = '请输入密码'; return }
  err.value = ''
  busy.value = true
  try {
    await auth.login(pw.value)
    // 登录后刷新 status 决定跳转
    status.value = await api.authStatus()
    if (status.value.logged_in) {
      router.replace(redirectTarget())
    } else {
      err.value = '登录状态异常, 请重试'
    }
  } catch (e) {
    err.value = (e && e.message) || '密码错误'
    pw.value = ''
  } finally {
    busy.value = false
    setTimeout(() => { try { inputRef.value && inputRef.value.focus() } catch (e) {} }, 0)
  }
}
</script>

<template>
  <div class="login-page">
    <form class="login-card" @submit.prevent="submit" autocomplete="on">
      <div class="brand">
        <div class="brand-logo">RC</div>
        <div class="brand-title">RainCough</div>
        <div class="brand-sub">登录面板</div>
      </div>

      <label class="field">
        <span class="field-label">密码</span>
        <input
          ref="inputRef"
          v-model="pw"
          type="password"
          class="field-input"
          :class="{ 'has-err': !!err }"
          :disabled="busy"
          autocomplete="current-password"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          @input="err = ''"
        />
      </label>

      <div class="hint" :class="{ 'hint-err': !!err }">
        <template v-if="err">{{ err }}</template>
        <template v-else-if="busy">验证中…</template>
        <template v-else-if="showSSHHint">
          输入你 SSH 登录本机的密码
          <span v-if="sshUser">(用户名 <code>{{ sshUser }}</code>)</span>
        </template>
        <template v-else-if="adminKind === '已设置, $6$ 哈希'">
          输入面板密码(安装时设置, 与你的 SSH 密码相同)
        </template>
        <template v-else>
          输入面板密码 — 首次启动已生成, 用
          <code>journalctl -u raincough -n 30 --no-pager</code> 查看
        </template>
      </div>

      <div v-if="shadowNote" class="shadow-note">
        系统密码无法离线校验：{{ shadowNote }}
      </div>

      <button class="btn-primary" type="submit" :disabled="busy || !pw">
        <span v-if="busy">登录中…</span>
        <span v-else>登录</span>
      </button>

      <div class="footer-note">
        session 默认 30 天有效 · cookie: rc_session (HttpOnly + Strict)
      </div>
    </form>
  </div>
</template>

<style scoped>
/* 全部颜色走设计系统变量(main.css :root / :root[data-theme=dark]),
   不在组件里硬编码色值 —— 否则暗色主题下会失配(已踩过: 输入框文字对比度 1.17)。 */
.login-page {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  z-index: 9000;
  padding: 16px;
}
.login-card {
  width: 100%;
  max-width: 360px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 30px 26px 22px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.brand { text-align: center; margin-bottom: 2px; }
.brand-logo {
  display: inline-block;
  width: 52px; height: 52px;
  line-height: 52px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent), #8b5cf6);
  color: #fff;
  font-weight: 700;
  font-size: 20px;
  letter-spacing: 1px;
  margin-bottom: 10px;
}
.brand-title { font-size: 18px; font-weight: 600; color: var(--text); }
.brand-sub { font-size: 12.5px; color: var(--text-muted); margin-top: 2px; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field-label {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.6px;
}
.field-input {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  font-size: 15px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  outline: none;
  color: var(--text);
  transition: border-color var(--transition), background var(--transition);
}
.field-input::placeholder { color: var(--text-faint); }
.field-input:focus {
  border-color: var(--accent);
  background: var(--surface);
  box-shadow: var(--ring);
}
.field-input.has-err { border-color: var(--danger); }
.field-input:disabled { opacity: 0.6; cursor: not-allowed; }

.hint {
  font-size: 12.5px;
  color: var(--text-muted);
  min-height: 18px;
  line-height: 1.5;
}
.hint code {
  background: var(--surface-3);
  color: var(--text);
  padding: 1px 5px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 11.5px;
}
.hint-err { color: var(--danger); }

.shadow-note {
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--text-muted);
  background: var(--surface-2);
  border-left: 2px solid var(--border-strong);
  padding: 6px 9px;
  border-radius: 3px;
  word-break: break-word;
}

.btn-primary {
  width: 100%;
  height: 42px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--transition), transform 60ms;
}
.btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.btn-primary:active:not(:disabled) { background: var(--accent-press); transform: scale(0.995); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.footer-note {
  text-align: center;
  font-size: 11px;
  color: var(--text-faint);
  margin-top: 2px;
}
</style>