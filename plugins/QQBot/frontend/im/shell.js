// 「消息」页 —— 仿 QQ 桌面端整屏视图（方案 A：插件内 fixed overlay）
//
// 布局：rail(56) + 会话列表(268) + 聊天区
// 数据：复用 qqbot.chat.sessions / qqbot.chat.messages，与「聊天记录」页同源
import {
  S, loadSessions, loadSelf, openSession, loadMessages, current,
} from './store.js'
import { fmtListTime, fmtDayLabel, fmtNum } from './util.js'
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
      for (const m of S.msgs) {
        if (!m) continue
        const txt = String(m.text || '')
        const sys = m.role === 'system' || (!(m.segs || []).length && txt.indexOf('撤回') >= 0)
        const gap = m.created_at - lastTs
        const showTime = (!lastTs || gap > 300) ? fmtDayLabel(m.created_at) : ''
        if (sys) {
          out.push({ type: 'sys', key: 's' + m.id, text: txt || '一条消息被撤回' })
          lastTs = m.created_at
          lastWho = ''
          continue
        }
        const who = String(m.sender_id || m.role || '')
        const compact = !showTime && who === lastWho && gap < 300
        out.push({ type: 'msg', key: m.id, m, compact, showTime })
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
    if (S.sid) await openSession(S.sid)
    // 首次进入滚到底
    this.$nextTick(() => this.toBottom(false))
    window.addEventListener('keydown', this.onKey)
    document.documentElement.style.overflow = 'hidden'
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.onKey)
    document.documentElement.style.overflow = ''
  },
  methods: {
    fmtListTime, fmtNum,
    onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); this.close() }
    },
    close() { this.$emit('close') },
    avatarOf(s) { return s && s.avatar ? s.avatar : '' },
    initialOf(s) { return String((s && (s.display || s.target_id)) || '?').trim().slice(0, 1) },
    pick(s) {
      if (!s || s.session_id === S.sid) return
      openSession(s.session_id).then(() => this.$nextTick(() => this.toBottom(false)))
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
          <input v-model="S.keyword" placeholder="搜索" />
        </div>
        <button class="im-ico" title="刷新会话" @click="reload">
          <svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a5 5 0 11-5 5H5a7 7 0 107-7z"/></svg>
        </button>
      </div>
      <div class="im-list">
        <div class="im-row" v-for="s in filtered" :key="s.session_id"
          :class="{ on: s.session_id === S.sid }" @click="pick(s)">
          <div class="ava">
            <img v-if="avatarOf(s) && !badAva[s.session_id]" :src="avatarOf(s)" alt=""
              @error="badAva[s.session_id] = true" />
            <div v-else class="ava-t">{{ initialOf(s) }}</div>
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
        <button class="im-ico" title="刷新" @click="reload">
          <svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a5 5 0 11-5 5H5a7 7 0 107-7z"/></svg>
        </button>
        <button class="im-ico" title="关闭（Esc）" @click="close">
          <svg viewBox="0 0 24 24"><path d="M6.4 5L5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5z"/></svg>
        </button>
      </div>

      <div class="im-flow" ref="flow" @scroll="onScroll">
        <div class="im-more" v-if="S.loadingMore">加载更早的消息…</div>
        <div class="im-more" v-else-if="!S.hasMore && S.msgs.length >= 50">已经到最早了</div>
        <div class="im-empty" v-if="!S.msgs.length && !S.loading">
          {{ cur ? '这个会话还没有消息' : '左边选一个会话' }}
        </div>
        <template v-for="r in rows" :key="r.key">
          <div class="im-sys" v-if="r.type === 'sys'"><span>{{ r.text }}</span></div>
          <im-message-row v-else :m="r.m" :compact="r.compact" :show-time="r.showTime" />
        </template>
      </div>

      <button class="im-jump" v-if="showJump" title="回到最新" @click="toBottom(true)">
        <svg viewBox="0 0 24 24"><path d="M12 16l-6-6 1.4-1.4L12 13.2l4.6-4.6L18 10l-6 6z"/></svg>
      </button>

      <!-- 输入区：P1 只读，发送能力下一阶段接入 -->
      <div class="im-composer">
        <div class="im-tools">
          <button class="im-tool" title="表情（待接入）" disabled>
            <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-3.5 7a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm7 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM12 18c-2.2 0-4.1-1.3-5-3h10c-.9 1.7-2.8 3-5 3z"/></svg>
          </button>
          <button class="im-tool" title="图片（待接入）" disabled>
            <svg viewBox="0 0 24 24"><path d="M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zm1 2v9l4-4 3 3 3-4 4 5V7H5zm3 1.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"/></svg>
          </button>
        </div>
        <textarea class="im-editor" rows="2" disabled
          placeholder="发送功能将在下一阶段接入 —— 当前可以浏览全部历史消息"></textarea>
        <div class="im-send">
          <span class="hint">只读模式</span>
          <button class="im-btn-send" disabled>发送</button>
        </div>
      </div>
    </div>
  </div>`,
}
