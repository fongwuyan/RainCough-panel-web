// 「消息」页 —— 仿 QQ 桌面端整屏视图（方案 A：插件内 fixed overlay）
//
// 布局：rail(56) + 会话列表(268) + 聊天区
// 数据：复用 qqbot.chat.sessions / qqbot.chat.messages，与「聊天记录」页同源
import {
  S, loadSessions, loadSelf, openSession, loadMessages, current,
  lastRead, markRead, callData,
} from './store.js'
import {
  fmtListTime, fmtDayLabel, fmtNum,
  partsOf, gridCls, mediaUrl, faceUrl, bytes, forwardIdOf,
} from './util.js'
import { ImMessageRow } from './message.js'

const RAIL = [
  { id: 'im', title: '消息', d: 'M4 5.5A2.5 2.5 0 016.5 3h11A2.5 2.5 0 0120 5.5v8a2.5 2.5 0 01-2.5 2.5H9l-4 4V16H6.5A2.5 2.5 0 014 13.5v-8z' },
  { id: 'contacts', title: '联系人', d: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-8 8a8 8 0 0116 0v1H4v-1z' },
  { id: 'star', title: '收藏', d: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z' },
]

export const IM = {
  components: { ImMessageRow },
  props: {},
  data() {
    return {
      S,
      rail: 'im',
      railItems: RAIL,
      showJump: false,
      dragging: false,
      sideWidth: 268,
      badAva: {},
      menu: null,          // 右键菜单 {x,y,m}
      readAt: 0,           // 上次看到的消息 id（本地，用于"以下为新消息"）
      toastMsg: '',
      fwd: null,           // 合并转发展开抽屉 {id, loading, nodes, total, error}
      fwdStack: [],        // 抽屉历史（转发里套转发时用来返回）
      sessMenu: null,      // 会话右键菜单 {x,y,s}
      searchOpen: false,   // 聊天区搜索框展开
      msgKw: '',           // 会话内搜索关键词
      rnd: null,           // 随机挑一条回复 {loading, scope, picked, reply, provider, error, token, sending, sent}
      rpCfg: { enabled: true, scope: 'enabled_groups' },  // 设置页里的开关与范围
      busy: '',
    }
  },
  computed: {
    cur() { return current() },
    filtered() {
      const k = (S.keyword || '').trim().toLowerCase()
      if (!k) return S.sessions
      return S.sessions.filter((s) => (s.display || '').toLowerCase().includes(k)
        || String(s.target_id || '').includes(k))
    },
    rows() {
      const out = []
      let lastTs = 0
      let lastWho = ''
      let marked = false
      for (const m of S.msgs) {
        if (!m) continue
        const txt = String(m.text || '')
        const sys = m.role === 'system' || (!(m.segs || []).length && txt.indexOf('撤回') >= 0)
        const gap = m.created_at - lastTs
        const showTime = (!lastTs || gap > 300) ? fmtDayLabel(m.created_at) : ''
        if (sys) {
          // 墓碑行的文案带方括号不好看，这里去掉
          const st = (txt || '有人撤回了一条消息').replace(/^\[/, '').replace(/\]$/, '')
          out.push({ type: 'sys', key: 's' + m.id, text: st })
          lastTs = m.created_at
          lastWho = ''
          continue
        }
        const who = String(m.sender_id || m.role || '')
        const compact = !showTime && who === lastWho && gap < 300
        const row = { type: 'msg', key: m.id, m, compact, showTime }
        // 第一次跨过"上次已读位置"的那条消息，前面插一条分割线
        if (!marked && this.readAt && Number(m.id) > this.readAt) {
          row.divider = true
          marked = true
        }
        out.push(row)
        lastTs = m.created_at
        lastWho = who
      }
      return out
    },
    total() { return (this.cur && this.cur.msg_count) || S.msgs.length },
  },
  async mounted() {
    await loadSelf()
    await loadSessions()
    // 随机挑消息回的开关与范围（设置页 → 能力）
    try {
      const cfg = await callData('rcbot.config.get')
      const rp = ((cfg || {}).features || {}).random_pick || {}
      this.rpCfg = {
        enabled: rp.enabled !== false,
        scope: rp.scope || 'enabled_groups',
      }
    } catch (e) { /* 拿不到就用默认值 */ }
    if (S.sid) {
      await openSession(S.sid)
      this.readAt = lastRead(S.sid)
      this.scheduleRead()
    }
    // 首次进入滚到底
    this.$nextTick(() => this.toBottom(false))
    window.addEventListener('keydown', this.onKey)
    window.addEventListener('click', this.closeMenu)
    document.documentElement.style.overflow = 'hidden'
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.onKey)
    window.removeEventListener('click', this.closeMenu)
    document.documentElement.style.overflow = ''
  },
  methods: {
    // ★ 模板里能用的只有 data/computed/methods/props，
    //   从 util.js import 进来的函数必须在这里挂一次，否则渲染时报
    //   "xxx is not a function"（踩过：gridCls）。
    fmtListTime, fmtNum,
    partsOf, gridCls, mediaUrl, faceUrl, bytes, forwardIdOf,
    onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); this.close() }
    },
    close() { this.$emit('close') },
    closeMenu() { this.menu = null; this.sessMenu = null },
    // 左侧搜索：后端在消息内容/发送者里找，本地再按会话名过一道
    onKwInput() {
      clearTimeout(this._kwTimer)
      this._kwTimer = setTimeout(() => { loadSessions(S.keyword) }, 350)
    },
    // ---------------- 会话内搜索（原「聊天记录」页的能力，合并过来）
    toggleSearch() {
      this.searchOpen = !this.searchOpen
      if (!this.searchOpen && this.msgKw) this.onSearch('')
      this.$nextTick(() => {
        const el = this.$refs.msgSearch
        if (el && this.searchOpen) el.focus()
      })
    },
    onSearch(kw) {
      const v = String(kw || '').trim()
      this.msgKw = v
      if (v === S.msgKeyword) return
      openSession(S.sid, v).then(() => {
        this.$nextTick(() => this.toBottom(false))
        this.schedulePendingRefresh()
      })
    },
    // ---------------- 随机挑一条消息回
    // 不是回当前这条，而是从**已启用的群聊**里随机翻一条出来，让机器人对它说点什么。
    openRandom() {
      if (!this.rpCfg.enabled) {
        this.toast('随机挑消息回已关闭（设置 → 能力）')
        return
      }
      this.rnd = { loading: false, scope: this.rpCfg.scope,
                   picked: null, reply: '', provider: '', error: '' }
      this.pickRandom()
    },
    closeRandom() { this.rnd = null },
    async pickRandom() {
      if (!this.rnd) return
      this.rnd.loading = true
      this.rnd.error = ''
      try {
        const d = await callData('qqbot.chat.random_reply', {
          sid: S.sid || '',
          scope: this.rnd.scope,
        })
        this.rnd.picked = (d && d.picked) || null
        this.rnd.reply = (d && d.reply) || ''
        this.rnd.provider = (d && d.provider) || ''
        this.rnd.token = (d && d.token) || ''
        this.rnd.sent = ''
      } catch (e) {
        this.rnd.error = String((e && e.message) || e)
        this.rnd.picked = null
        this.rnd.reply = ''
        this.rnd.token = ''
        this.rnd.sent = ''
      } finally {
        this.rnd.loading = false
      }
    },
    // 把这条回复真的发到 QQ（发到被挑中消息所在的那个群）
    async sendRandom() {
      if (!this.rnd || !this.rnd.token) return
      const p = this.rnd.picked || {}
      const where = p.title || p.target_id || ''
      if (!confirm('把这条回复发到「' + where + '」？\n\n会 @ 一下原说话人。')) return
      this.rnd.sending = true
      this.rnd.sent = ''
      try {
        const d = await callData('qqbot.chat.random_reply.send', { token: this.rnd.token })
        this.rnd.token = ''    // 一条结果只发一次
        this.rnd.sent = '已发到「' + where + '」'
        this.toast('已发送到 QQ')
        // 群里多了一条消息，把当前会话刷一下
        loadMessages(false)
      } catch (e) {
        this.rnd.sent = '发送失败：' + String((e && e.message) || e)
      } finally {
        this.rnd.sending = false
      }
    },
    // 临时在「当前会话」和「设置里的范围」之间切
    switchScope() {
      if (!this.rnd) return
      this.rnd.scope = this.rnd.scope === 'session' ? this.rpCfg.scope : 'session'
      this.pickRandom()
    },
    scopeLabel(s) {
      if (s === 'session') return '当前会话'
      if (s === 'all_groups') return '所有群聊'
      return '已启用的群聊'
    },
    // ---------------- 会话导出 / 清空（原「聊天记录」页）
    async exportSession(s) {
      const sid = (s && s.session_id) || S.sid
      this.sessMenu = null
      if (!sid) return
      this.busy = 'exp'
      try {
        const d = await callData('qqbot.chat.export', { session_id: sid })
        const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'chat-' + String(sid).replace(/[^\w-]/g, '_') + '-' + Date.now() + '.json'
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 3000)
        this.toast('已导出会话记录')
      } catch (e) {
        this.toast(String((e && e.message) || e))
      } finally {
        this.busy = ''
      }
    },
    async clearSession(s) {
      const sid = (s && s.session_id) || S.sid
      const name = s ? (s.display || s.target_id) : '这个会话'
      this.sessMenu = null
      if (!sid) return
      if (!confirm('清空会话「' + name + '」的全部聊天记录？\n\n此操作不可撤销。')) return
      const withMedia = confirm(
        '要连图片/视频/语音这些媒体文件一起删掉吗？\n\n确定 = 一起删\n取消 = 只删文字记录（媒体保留）')
      this.busy = 'clear'
      try {
        const r = await callData('qqbot.chat.clear_session',
          { session_id: sid, with_media: withMedia, confirm: true })
        this.toast('已清空 ' + ((r && r.messages) || 0) + ' 条消息')
        await loadSessions()
        await openSession(S.sid, S.msgKeyword)
      } catch (e) {
        this.toast(String((e && e.message) || e))
      } finally {
        this.busy = ''
      }
    },
    // 转码中的媒体：定时重载当前会话，直到都转完
    hasPending() {
      for (const m of S.msgs) {
        for (const md of (m.media || [])) {
          if (md && md.transcode === 'pending') return true
        }
      }
      return false
    },
    schedulePendingRefresh() {
      clearTimeout(this._pendTimer)
      if (!this.hasPending()) return
      this._pendTimer = setTimeout(async () => {
        this._pendTimer = null
        await loadMessages(false)
        this.schedulePendingRefresh()
      }, 6000)
    },

    // ---------------- 会话操作（置顶 / 免打扰 / 已读）
    openSessMenu(e, s) {
      this.sessMenu = { x: e.clientX, y: e.clientY, s }
    },
    async togglePin(s) {
      this.sessMenu = null
      if (!s) return
      try {
        const r = await callData('qqbot.chat.session_ui',
          { session_id: s.session_id, pinned: !s.pinned })
        s.pinned = r && typeof r.pinned !== 'undefined' ? r.pinned : (s.pinned ? 0 : 1)
        this.toast(s.pinned ? '已置顶' : '已取消置顶')
        await loadSessions()          // 重新排序（置顶的排前面）
      } catch (e) {
        this.toast(String((e && e.message) || e))
      }
    },
    async toggleMute(s) {
      this.sessMenu = null
      if (!s) return
      try {
        const r = await callData('qqbot.chat.session_ui',
          { session_id: s.session_id, muted: !s.muted })
        s.muted = r && typeof r.muted !== 'undefined' ? r.muted : (s.muted ? 0 : 1)
        this.toast(s.muted ? '已免打扰' : '已取消免打扰')
      } catch (e) {
        this.toast(String((e && e.message) || e))
      }
    },
    markReadNow(s) {
      this.sessMenu = null
      if (!s) return
      const lr = lastRead(s.session_id)
      if (lr) {
        callData('qqbot.chat.session_ui', { session_id: s.session_id, last_read_id: lr })
          .catch(() => {})
      }
      s.unread = 0
    },

    // ---------------- 合并转发展开
    //
    // 消息里只有一个 forward id，内容要问后端要（后端会顺带把图片落盘）。
    async openForward(id) {
      if (!id) return
      if (this.fwd) this.fwdStack.push(this.fwd)   // 套娃时能返回上一层
      this.fwd = { id, loading: true, nodes: [], total: 0, error: '' }
      try {
        const d = await callData('qqbot.chat.forward', { id })
        const total = (d && d.total) || 0
        this.fwd = {
          id,
          loading: false,
          nodes: (d && d.nodes) || [],
          total,
          error: '',
        }
        // 记下条数，气泡上的卡片可以直接显示「N 条消息」
        for (const m of S.msgs) {
          if (forwardIdOf(m) === id) { m._fwdCount = total; break }
        }
      } catch (e) {
        this.fwd = { id, loading: false, nodes: [], total: 0, error: String((e && e.message) || e) }
      }
    },
    backForward() { this.fwd = this.fwdStack.pop() || null },
    closeForward() { this.fwd = null; this.fwdStack = [] },
    fwdParts(n) { return partsOf({ segs: (n && n.segs) || [] }).parts },
    fwdImgs(n) { return ((n && n.media) || []).filter((m) => m.kind === 'image' && m.local) },
    fwdOther(n) { return ((n && n.media) || []).filter((m) => m.kind !== 'image' && m.local) },
    openCtx(e, m) {
      this.menu = { x: e.clientX, y: e.clientY, m }
    },
    canRecall(m) { return !!(m && m.msg_id && (m.role === 'assistant') && !m.recalled) },
    copyMsg(m) {
      const t = String((m && (m.text || (m.segs || []).map((x) => (x.data || {}).text || '').join(''))) || '')
      try {
        navigator.clipboard.writeText(t)
        this.toast('已复制')
      } catch (e) {
        this.toast('复制失败（浏览器不允许）')
      }
      this.menu = null
    },
    async doRecall(m) {
      this.menu = null
      if (!m || !m.msg_id) return
      try {
        await callData('qqbot.chat.recall', { msg_id: m.msg_id })
        m.recalled = 1
        this.toast('已撤回')
      } catch (e) {
        this.toast(String((e && e.message) || e))
      }
    },
    jump(msgId) {
      const id = String(msgId || '')
      if (!id) return
      // 引用里存的是 OneBot 的 message_id，而行上的 data-mid 是数据库行 id，
      // 两者不是一回事 —— 先按 data-msgid 找，找不到再按行 id 兜底。
      const esc = id.replace(/"/g, '\\"')
      const el = document.querySelector('.rcq-im [data-msgid="' + esc + '"]')
        || document.querySelector('.rcq-im [data-mid="' + esc + '"]')
      if (!el) { this.toast('被引用的消息不在当前页'); return }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.classList.add('im-flash')
      setTimeout(() => el.classList.remove('im-flash'), 1200)
    },
    toast(t) {
      this.toastMsg = String(t || '')
      clearTimeout(this._tt)
      this._tt = setTimeout(() => { this.toastMsg = '' }, 1800)
    },
    scheduleRead() {
      clearTimeout(this._rt)
      this._rt = setTimeout(() => {
        if (S.msgs.length) markRead(S.sid, S.msgs[S.msgs.length - 1].id)
      }, 1200)
    },
    avatarOf(s) { return s && s.avatar ? s.avatar : '' },
    initialOf(s) { return String((s && (s.display || s.target_id)) || '?').trim().slice(0, 1) },
    pick(s) {
      if (!s || s.session_id === S.sid) return
      s.unread = 0
      openSession(s.session_id).then(() => {
        this.readAt = lastRead(s.session_id)
        this.$nextTick(() => this.toBottom(false))
        this.scheduleRead()
        this.schedulePendingRefresh()
      })
    },
    toBottom(smooth = true) {
      const el = this.$refs.flow
      if (!el) return
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
      S.atBottom = true
      this.showJump = false
    },
    async onScroll() {
      const el = this.$refs.flow
      if (!el) return
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
      S.atBottom = nearBottom
      this.showJump = !nearBottom
      // 滚到顶部附近 → 加载更早，并补偿滚动位置（锚点）
      if (el.scrollTop < 160 && S.hasMore && !S.loadingMore) {
        const prevH = el.scrollHeight
        const prevTop = el.scrollTop
        await loadMessages(true)
        this.$nextTick(() => {
          const el2 = this.$refs.flow
          if (!el2) return
          el2.scrollTop = el2.scrollHeight - prevH + prevTop
        })
      }
    },
    async reload() {
      await loadSessions()
      if (S.sid) {
        await openSession(S.sid)
        this.$nextTick(() => this.toBottom(false))
      }
    },
  },
  template: `
  <div class="rcq-im">
    <!-- rail -->
    <div class="im-rail">
      <div class="ava"><img v-if="S.uin" :src="'https://q1.qlogo.cn/g?b=qq&nk=' + S.uin + '&s=100'" alt="" /></div>
      <button v-for="it in railItems" :key="it.id" class="im-nav" :class="{ on: rail === it.id }"
        :title="it.title" @click="rail = it.id">
        <svg viewBox="0 0 24 24"><path :d="it.d" /></svg>
      </button>
      <button class="im-nav" title="返回面板" @click="close">
        <svg viewBox="0 0 24 24"><path d="M10 4H5a1 1 0 00-1 1v14a1 1 0 001 1h5v-2H6V6h4V4zm4 0v2h4v12h-4v2h5a1 1 0 001-1V5a1 1 0 00-1-1h-5zM11 11h4l-2-2 1.4-1.4L19 12l-4.6 4.4L13 15l2-2h-4v-2z"/></svg>
      </button>
      <div class="sp"></div>
      <button class="im-nav" title="设置" @click="close">
        <svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm9 4c0-.6-.1-1.2-.2-1.8l2-1.5-2-3.4-2.3 1a8 8 0 00-3-1.7L15 2H9l-.5 2.6a8 8 0 00-3 1.7l-2.3-1-2 3.4 2 1.5a9 9 0 000 3.6l-2 1.5 2 3.4 2.3-1a8 8 0 003 1.7L9 22h6l.5-2.6a8 8 0 003-1.7l2.3 1 2-3.4-2-1.5c.1-.6.2-1.2.2-1.8z"/></svg>
      </button>
    </div>

    <!-- 会话列表 -->
    <div class="im-side" :style="{ width: sideWidth + 'px' }">
      <div class="im-side-h">
        <div class="im-search">
          <svg viewBox="0 0 24 24"><path d="M10 4a6 6 0 014.5 10.1l4.2 4.2-1.4 1.4-4.2-4.2A6 6 0 1110 4zm0 2a4 4 0 100 8 4 4 0 000-8z"/></svg>
          <input v-model="S.keyword" placeholder="搜索会话/消息内容" @input="onKwInput" />
        </div>
        <button class="im-ico" title="刷新会话" @click="reload">
          <svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a5 5 0 11-5 5H5a7 7 0 107-7z"/></svg>
        </button>
      </div>
      <div class="im-list">
        <div class="im-row" v-for="s in filtered" :key="s.session_id"
          :class="{ on: s.session_id === S.sid, muted: s.muted }" @click="pick(s)"
          @contextmenu.prevent="openSessMenu($event, s)">
          <div class="ava">
            <img v-if="avatarOf(s) && !badAva[s.session_id]" :src="avatarOf(s)" alt=""
              @error="badAva[s.session_id] = true" />
            <div v-else class="ava-t">{{ initialOf(s) }}</div>
            <span class="pin" v-if="s.pinned" title="已置顶">
              <svg viewBox="0 0 24 24"><path d="M16 9V4h1a1 1 0 000-2H7a1 1 0 000 2h1v5c0 1.66-1.34 3-3 3v2h5v7l1 1 1-1v-7h5v-2c-1.66 0-3-1.34-3-3z"/></svg>
            </span>
          </div>
          <div class="main">
            <div class="top">
              <div class="nm">{{ s.display || s.target_id }}</div>
              <div class="tm">{{ fmtListTime(s.last_at) }}</div>
            </div>
            <div class="pv">
              <template v-if="s.preview">
                <span v-if="s.preview_who" class="pv-who">{{ s.preview_who }}：</span>{{ s.preview }}
              </template>
              <template v-else>{{ s.msg_count || 0 }} 条消息</template>
            </div>
          </div>
          <span class="badge" v-if="s.unread && !s.muted">{{ s.unread > 99 ? '99+' : s.unread }}</span>
          <span class="dot" v-else-if="s.unread && s.muted"></span>
        </div>
        <div class="im-empty" v-if="!filtered.length">
          {{ S.keyword ? '没有匹配的会话' : '还没有聊天记录' }}
        </div>
      </div>
    </div>

    <!-- 聊天区 -->
    <div class="im-chat">
      <div class="im-head">
        <div class="tt">{{ (cur && (cur.display || cur.target_id)) || '选择一个会话' }}</div>
        <div class="sub" v-if="cur">{{ fmtNum(total) }} 条</div>
        <div class="sp"></div>
        <div class="im-hsearch" v-if="searchOpen">
          <svg viewBox="0 0 24 24"><path d="M10 4a6 6 0 014.5 10.1l4.2 4.2-1.4 1.4-4.2-4.2A6 6 0 1110 4zm0 2a4 4 0 100 8 4 4 0 000-8z"/></svg>
          <input ref="msgSearch" :value="msgKw" placeholder="搜索本会话的消息"
            @input="onSearch($event.target.value)" />
          <button v-if="msgKw" class="im-hclear" title="清除" @click="onSearch('')">×</button>
        </div>
        <button class="im-ico" :title="rpCfg.enabled ? '随机挑一条群里的消息，让机器人回它' : '随机挑消息回已关闭（设置 → 能力）'"
          @click="openRandom">
          <svg viewBox="0 0 24 24"><path d="M12 2l2.2 5.6L20 9l-4.6 3.4L16.6 18 12 14.9 7.4 18l1.2-5.6L4 9l5.8-1.4L12 2z"/></svg>
        </button>
        <button class="im-ico" title="搜索本会话消息" @click="toggleSearch">
          <svg viewBox="0 0 24 24"><path d="M10 4a6 6 0 014.5 10.1l4.2 4.2-1.4 1.4-4.2-4.2A6 6 0 1110 4zm0 2a4 4 0 100 8 4 4 0 000-8z"/></svg>
        </button>
        <button class="im-ico" title="刷新" @click="reload">
          <svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a5 5 0 11-5 5H5a7 7 0 107-7z"/></svg>
        </button>
        <button class="im-ico" title="关闭（Esc）" @click="close">
          <svg viewBox="0 0 24 24"><path d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5z"/></svg>
        </button>
      </div>

      <div class="im-flow" ref="flow" @scroll="onScroll">
        <div class="im-srch" v-if="S.msgKeyword">
          搜索「{{ S.msgKeyword }}」找到 {{ S.msgs.length }} 条
          <button class="im-hclear" @click="onSearch(''); msgKw = ''">清除</button>
        </div>
        <div class="im-more" v-if="S.loadingMore">加载更早的消息…</div>
        <div class="im-more" v-else-if="!S.hasMore && S.msgs.length >= 50">已经到最早了</div>
        <div class="im-empty" v-if="!S.msgs.length && !S.loading">
          {{ cur ? '这个会话还没有消息' : '左边选一个会话' }}
        </div>
        <template v-for="r in rows" :key="r.key">
          <div class="im-sys" v-if="r.type === 'sys'"><span>{{ r.text }}</span></div>
          <template v-else>
            <div class="im-divider" v-if="r.divider">以下为新消息</div>
            <im-message-row :m="r.m" :compact="r.compact" :show-time="r.showTime"
              @ctx="openCtx" @copy="copyMsg" @recall="doRecall" @jump="jump"
              @forward="openForward" />
          </template>
        </template>
      </div>

      <button class="im-jump" v-if="showJump" title="回到最新" @click="toBottom(true)">
        <svg viewBox="0 0 24 24"><path d="M12 16l-6-6 1.4-1.4L12 13.2l4.6-4.6L18 10l-6 6z"/></svg>
      </button>

      <!-- 合并转发展开抽屉 -->
      <div class="im-fwd" v-if="fwd">
        <div class="fh">
          <button class="im-ico" v-if="fwdStack.length" title="返回上一层" @click="backForward">
            <svg viewBox="0 0 24 24"><path d="M15.4 7.4L14 6l-6 6 6 6 1.4-1.4-4.6-4.6z"/></svg>
          </button>
          <div class="ft">
            合并转发<template v-if="fwd.total"> · {{ fwd.total }} 条</template>
          </div>
          <button class="im-ico" title="关闭" @click="closeForward">
            <svg viewBox="0 0 24 24"><path d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5z"/></svg>
          </button>
        </div>
        <div class="fb">
          <div class="im-more" v-if="fwd.loading">正在展开…</div>
          <div class="im-empty" v-else-if="fwd.error">{{ fwd.error }}</div>
          <div class="im-empty" v-else-if="!fwd.nodes.length">没有可显示的内容</div>
          <div class="fn" v-for="(n,i) in fwd.nodes" :key="i">
            <div class="fn-h">
              <img class="fava" v-if="n.sender_id"
                :src="'https://q1.qlogo.cn/g?b=qq&nk=' + n.sender_id + '&s=100'" alt="" />
              <span class="fnm">{{ n.sender_name }}</span>
              <span class="ftm">{{ fmtListTime(n.time) }}</span>
            </div>
            <div class="fn-b">
              <span v-for="(p,pi) in fwdParts(n)" :key="pi">
                <span v-if="p.t === 'text'">{{ p.v }}</span>
                <span v-else-if="p.t === 'at'" class="at">{{ p.v }}</span>
                <img v-else-if="p.t === 'face'" class="face" :src="faceUrl(p.v)" alt="[表情]" />
              </span>
              <div class="im-grid" :class="gridCls(fwdImgs(n).length)" v-if="fwdImgs(n).length">
                <img v-for="(m,mi) in fwdImgs(n)" :key="mi" :src="mediaUrl(m)" loading="lazy" alt="图片" />
              </div>
              <div class="fn-f" v-for="(m,mi) in fwdOther(n)" :key="'f'+mi">
                {{ m.name || m.kind }} · {{ bytes(m.bytes) }}
              </div>
              <button class="fn-nested" v-if="n.nested" @click="openForward(n.nested)">
                （这条里还嵌套了一个合并转发，点击展开）
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 随机挑一条回复 -->
      <div class="im-rnd" v-if="rnd">
        <div class="fh">
          <div class="ft">随机挑一条回复</div>
          <button class="scope" title="切换挑选范围" @click="switchScope">
            {{ scopeLabel(rnd.scope) }}
          </button>
          <button class="im-ico" title="关闭" @click="closeRandom">
            <svg viewBox="0 0 24 24"><path d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5z"/></svg>
          </button>
        </div>
        <div class="fb">
          <div class="im-more" v-if="rnd.loading">正在挑…</div>
          <div class="im-empty" v-else-if="rnd.error">{{ rnd.error }}</div>
          <template v-else-if="rnd.picked">
            <div class="rnd-hint">从已启用的群聊里随机翻了一条出来，让机器人对它说点什么。满意就点「发送到 QQ」。</div>
            <div class="rnd-pick">
              <div class="rnd-pick-h">
                <span class="rnd-who">{{ rnd.picked.sender_name || rnd.picked.sender_id }}</span>
                <span class="rnd-where">{{ rnd.picked.title || rnd.picked.target_id }}</span>
                <span class="rnd-time">{{ fmtListTime(rnd.picked.created_at) }}</span>
              </div>
              <div class="rnd-text">{{ rnd.picked.text }}</div>
            </div>
            <div class="rnd-arrow">↓ 机器人这样回</div>
            <div class="rnd-reply">{{ rnd.reply }}</div>
            <div class="rnd-foot" v-if="rnd.provider">用 {{ rnd.provider }} 生成</div>
            <div class="rnd-sent" v-if="rnd.sent"
              :class="rnd.sent.indexOf('失败') >= 0 ? 'bad' : 'ok'">{{ rnd.sent }}</div>
          </template>
          <div class="im-empty" v-else>没有可挑的消息</div>
        </div>
        <div class="rf">
          <button class="primary" :disabled="rnd.loading || rnd.sending || !rnd.token"
            @click="sendRandom">{{ rnd.sending ? '发送中…' : '发送到 QQ' }}</button>
          <button :disabled="rnd.loading" @click="pickRandom">换一个</button>
          <button @click="closeRandom">关闭</button>
        </div>
      </div>

      <!-- 只读栏：本页不提供通用发送入口（随机挑回复可单独发到 QQ） -->
      <div class="im-readonly">
        <svg viewBox="0 0 24 24"><path d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8z"/></svg>
        <span>只读模式 · 本页仅用于浏览消息；🎲 随机挑的回复可手动发到 QQ</span>
      </div>
    </div>

    <div class="im-menu" v-if="menu" :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
      @click.stop>
      <button @click="copyMsg(menu.m)">复制文字</button>
      <button v-if="canRecall(menu.m)" @click="doRecall(menu.m)">撤回</button>
    </div>

    <div class="im-menu" v-if="sessMenu" :style="{ left: sessMenu.x + 'px', top: sessMenu.y + 'px' }"
      @click.stop>
      <button @click="togglePin(sessMenu.s)">{{ sessMenu.s.pinned ? '取消置顶' : '置顶该会话' }}</button>
      <button @click="toggleMute(sessMenu.s)">{{ sessMenu.s.muted ? '取消免打扰' : '消息免打扰' }}</button>
      <button @click="markReadNow(sessMenu.s)">标记为已读</button>
      <button @click="exportSession(sessMenu.s)">导出会话 JSON</button>
      <button @click="clearSession(sessMenu.s)">清空会话…</button>
    </div>

    <div class="im-toast" v-if="toastMsg">{{ toastMsg }}</div>
  </div>`,
}
