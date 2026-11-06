// 「消息」页 —— 仿 QQ 桌面端整屏视图（方案 A：插件内 fixed overlay）
//
// 布局：rail(56) + 会话列表(268) + 聊天区
// 数据：复用 qqbot.chat.sessions / qqbot.chat.messages，与「聊天记录」页同源
import {
  S, loadSessions, loadSelf, openSession, loadMessages, current,
  sendText, retrySend, sendImage, lastRead, markRead, callData,
} from './store.js'
import {
  fmtListTime, fmtDayLabel, fmtNum, faceUrl,
  FACE_IDS, FACE_NAMES, recentFaces, pushRecentFace,
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
      sending: false,
      menu: null,          // 右键菜单 {x,y,m}
      quote: null,         // 正在引用的消息
      readAt: 0,           // 上次看到的消息 id（本地，用于"以下为新消息"）
      toastMsg: '',
      showFace: false,
      showAt: false,
      faceIds: FACE_IDS,
      recent: [],
      canSend: false,
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
          out.push({ type: 'sys', key: 's' + m.id, text: txt || '一条消息被撤回' })
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
    // @ 候选：从本会话已加载消息里取发言者（去重、排除自己）
    people() {
      const seen = new Map()
      for (const m of S.msgs) {
        const id = String(m.sender_id || '')
        if (!id || id === S.uin) continue
        if (!seen.has(id)) {
          seen.set(id, { id, name: m.sender_name || id, avatar: m.sender_avatar || '' })
        }
      }
      return [...seen.values()].slice(0, 30)
    },
  },
  async mounted() {
    await loadSelf()
    await loadSessions()
    if (S.sid) {
      await openSession(S.sid)
      this.readAt = lastRead(S.sid)
      this.$nextTick(() => this.loadDraft(S.sid))
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
    fmtListTime, fmtNum,
    onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); this.close() }
    },
    close() { this.$emit('close') },
    // ---------------- 富文本输入区（表情 / @ / 混排）
    //
    // 用 contenteditable 而不是 textarea：QQ 的表情和 @ 是"行内对象"，
    // 纯文本表达不了。发送时再把 DOM 走一遍还原成 OneBot 段数组。
    faceUrl,
    toggleFace() {
      this.showFace = !this.showFace
      if (this.showFace) {
        this.showAt = false
        this.recent = recentFaces()
        // 每次打开都回到顶部（否则会停在上一轮的滚动位置，看着像"表情少了"）
        this.$nextTick(() => {
          const el = this.$el && this.$el.querySelector('.im-facepanel')
          if (el) el.scrollTop = 0
        })
      }
    },
    faceName(id) { return FACE_NAMES[id] || ('表情 ' + id) },
    // 表情图偶发 404/中断：带时间戳重试一次，还失败就藏起来（不留破图）
    faceRetry(e) {
      const el = e && e.target
      if (!el) return
      if (el.dataset && el.dataset.retried) { el.style.visibility = 'hidden'; return }
      if (el.dataset) el.dataset.retried = '1'
      el.src = String(el.src || '').split('?')[0] + '?r=' + Date.now()
    },
    toggleAt() { this.showAt = !this.showAt; if (this.showAt) this.showFace = false },

    hasContent() {
      const el = this.$refs.editor
      if (!el) return false
      const txt = String(el.innerText || '').replace(/[\u200b\s]/g, '')
      return !!txt || !!el.querySelector('img[data-face]')
    },
    onInput() {
      this.canSend = this.hasContent()
      clearTimeout(this._dt)
      this._dt = setTimeout(() => this.saveDraft(), 300)
    },
    onPaste(e) {
      const cd = e.clipboardData || window.clipboardData
      // 粘贴图片：直接发（截图工具最常见的用法）
      const items = (cd && cd.items) || []
      for (const it of items) {
        if (it.kind === 'file' && /^image\//.test(it.type || '')) {
          e.preventDefault()
          const f = it.getAsFile()
          if (f) this.doSendImage(f)
          return
        }
      }
      // 纯文本：直接插入 HTML 会带一堆样式，甚至脚本
      e.preventDefault()
      const t = (cd && cd.getData('text')) || ''
      document.execCommand('insertText', false, t)
    },
    insertNode(node) {
      const el = this.$refs.editor
      if (!el) return
      el.focus()
      const sel = window.getSelection()
      if (sel && sel.rangeCount && el.contains(sel.anchorNode)) {
        const r = sel.getRangeAt(0)
        r.deleteContents()
        r.insertNode(node)
        r.setStartAfter(node)
        r.collapse(true)
        sel.removeAllRanges()
        sel.addRange(r)
      } else {
        el.appendChild(node)
      }
      this.onInput()
    },
    addFace(id) {
      pushRecentFace(id)
      this.recent = recentFaces()
      const img = document.createElement('img')
      img.className = 'face'
      img.setAttribute('data-face', String(id))
      img.src = faceUrl(id)
      img.alt = '[表情]'
      img.onerror = () => this.faceRetry({ target: img })
      this.insertNode(img)
    },
    addAt(p) {
      const sp = document.createElement('span')
      sp.className = 'at-chip'
      sp.setAttribute('data-at', String(p.id))
      sp.setAttribute('data-name', p.name || '')
      sp.textContent = '@' + (p.name || p.id)
      const space = document.createTextNode('\u00a0')
      this.insertNode(sp)
      this.insertNode(space)
      this.showAt = false
    },
    serialize() {
      const el = this.$refs.editor
      const out = []
      let buf = ''
      const flush = () => { if (buf) { out.push({ type: 'text', data: { text: buf } }); buf = '' } }
      const walk = (node) => {
        for (const n of node.childNodes) {
          if (n.nodeType === 3) { buf += n.textContent; continue }
          if (n.nodeType !== 1) continue
          const d = n.dataset || {}
          if (d.face) { flush(); out.push({ type: 'face', data: { id: String(d.face) } }) }
          else if (d.at) { flush(); out.push({ type: 'at', data: { qq: String(d.at), name: d.name || '' } }) }
          else if (n.tagName === 'BR') buf += '\n'
          else if (n.tagName === 'DIV' || n.tagName === 'P') { walk(n); buf += '\n' }
          else walk(n)
        }
      }
      if (el) walk(el)
      flush()
      // 去掉末尾多余换行
      if (out.length && out[out.length - 1].type === 'text') {
        out[out.length - 1].data.text = out[out.length - 1].data.text.replace(/\n+$/, '')
        if (!out[out.length - 1].data.text) out.pop()
      }
      return out
    },
    clearEditor() {
      const el = this.$refs.editor
      if (el) el.innerHTML = ''
      this.canSend = false
      this.saveDraft()
    },
    saveDraft() {
      const el = this.$refs.editor
      const sid = S.sid
      if (!el || !sid) return
      try {
        const html = el.innerHTML
        if (html && html !== '<br>') localStorage.setItem('rcq.im.draft.' + sid, html)
        else localStorage.removeItem('rcq.im.draft.' + sid)
      } catch (e) {}
    },
    loadDraft(sid) {
      const el = this.$refs.editor
      if (!el) return
      let html = ''
      try { html = localStorage.getItem('rcq.im.draft.' + sid) || '' } catch (e) {}
      el.innerHTML = html
      // 草稿里的表情是 innerHTML 带回来的，没挂过 onerror；
      // 之前加载失败过的，这里补一次重试，否则会一直显示破图
      el.querySelectorAll('img.face').forEach((img) => {
        // ★ 草稿存的是 innerHTML，会把上一轮的"已隐藏/已重试"状态一起存回来。
        //   这里一律按 data-face 重新拼 src，并把状态标记清掉 ——
        //   否则一个曾经失败的表情会永远卡在破图（实测踩到）。
        img.style.visibility = ''
        if (img.dataset) delete img.dataset.retried
        const id = img.getAttribute('data-face')
        if (id !== null) img.src = faceUrl(id)
        img.onerror = () => this.faceRetry({ target: img })
      })
      this.canSend = this.hasContent()
    },

    pickImage() {
      const el = this.$refs.fileInput
      if (el) { el.value = ''; el.click() }
    },
    async onPickFile(e) {
      const f = e.target && e.target.files && e.target.files[0]
      if (!f) return
      await this.doSendImage(f)
    },
    async onDrop(e) {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
      if (!f) return
      if (!/^image\//.test(f.type || '')) { this.toast('只支持拖入图片'); return }
      await this.doSendImage(f)
    },
    async doSendImage(file) {
      if (!this.cur) return
      const q = this.quote
      this.quote = null
      try {
        await sendImage(file, q && q.msg_id, q)
        this.toast('图片已发送')
      } catch (err) {
        this.toast(String((err && err.message) || err))
      } finally {
        this.$nextTick(() => this.toBottom(true))
      }
    },

    async onSend() {
      const segs = this.serialize()
      if (!segs.length || !this.cur || this.sending) return
      const text = segs.filter((x) => x.type === 'text')
        .map((x) => x.data.text).join('').trim()
      const q = this.quote
      this.quote = null
      this.sending = true
      this.clearEditor()
      try {
        await sendText(text, q && q.msg_id, q, segs)
      } catch (e) {
        // 失败项已经在列表里标红
      } finally {
        this.sending = false
        this.$nextTick(() => this.toBottom(true))
      }
    },
    onKeydown(e) {
      if (e.key === 'Escape') { this.showFace = false; this.showAt = false; return }
      // QQ 桌面端默认：Enter 发送、Shift+Enter 换行
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault()
        this.onSend()
      }
    },
    closeMenu() { this.menu = null },
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
    quoteMsg(m) {
      const t = String((m && (m.text || '')) || '').slice(0, 60)
      const who = (m && m.sender_name) || ''
      this.quote = { msg_id: m.msg_id, sender: who, text: t }
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
    async onRetry(m) {
      try { await retrySend(m) } catch (e) {}
      this.$nextTick(() => this.toBottom(true))
    },
    avatarOf(s) { return s && s.avatar ? s.avatar : '' },
    initialOf(s) { return String((s && (s.display || s.target_id)) || '?').trim().slice(0, 1) },
    pick(s) {
      if (!s || s.session_id === S.sid) return
      this.saveDraft()
      this.quote = null
      this.showFace = false
      this.showAt = false
      openSession(s.session_id).then(() => {
        this.readAt = lastRead(s.session_id)
        this.$nextTick(() => {
          this.toBottom(false)
          this.loadDraft(s.session_id)
        })
        this.scheduleRead()
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
    <div class="im-chat" @dragover.prevent @drop.prevent="onDrop">
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
          <template v-else>
            <div class="im-divider" v-if="r.divider">以下为新消息</div>
            <im-message-row :m="r.m" :compact="r.compact" :show-time="r.showTime"
              @retry="onRetry" @ctx="openCtx" @copy="copyMsg" @quote="quoteMsg"
              @recall="doRecall" @jump="jump" />
          </template>
        </template>
      </div>

      <button class="im-jump" v-if="showJump" title="回到最新" @click="toBottom(true)">
        <svg viewBox="0 0 24 24"><path d="M12 16l-6-6 1.4-1.4L12 13.2l4.6-4.6L18 10l-6 6z"/></svg>
      </button>

      <!-- 输入区：P1 只读，发送能力下一阶段接入 -->
      <div class="im-composer">
        <div class="im-tools">
          <button class="im-tool" :class="{ on: showFace }" title="表情"
            @click="toggleFace">
            <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-3.5 7a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm7 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM12 18c-2.2 0-4.1-1.3-5-3h10c-.9 1.7-2.8 3-5 3z"/></svg>
          </button>
          <button class="im-tool" :class="{ on: showAt }" title="@ 某人"
            @click="toggleAt" :disabled="!cur">@</button>
          <button class="im-tool" title="发送图片" @click="pickImage" :disabled="!cur">
            <svg viewBox="0 0 24 24"><path d="M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zm1 2v9l4-4 3 3 3-4 4 5V7H5zm3 1.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"/></svg>
          </button>
        </div>
        <div class="im-quote-bar" v-if="quote">
          <span class="qq">引用 {{ quote.sender || '消息' }}：{{ quote.text }}</span>
          <button class="qx" title="取消引用" @click="quote = null">×</button>
        </div>
        <div class="im-editor" ref="editor" contenteditable="true"
          :data-ph="cur ? '输入消息，Enter 发送，Shift+Enter 换行' : '先在左边选一个会话'"
          @input="onInput" @keydown="onKeydown" @paste="onPaste"></div>
        <div class="im-send">
          <span class="hint">{{ cur ? 'Enter 发送 · Shift+Enter 换行' : '' }}</span>
          <button class="im-btn-send" :disabled="!canSend || !cur || sending"
            @click="onSend">{{ sending ? '发送中…' : '发送' }}</button>
        </div>

        <input type="file" accept="image/*" ref="fileInput" style="display:none"
          @change="onPickFile" />

        <!-- 表情面板 -->
        <div class="im-facepanel" v-if="showFace" @click.stop>
          <template v-if="recent.length">
            <div class="im-facelbl">最近使用</div>
            <div class="im-facegrid">
              <img v-for="id in recent" :key="'r' + id" :src="faceUrl(id)" loading="lazy"
                :title="faceName(id)" :alt="faceName(id)" @click="addFace(id)"
                @error="faceRetry" />
            </div>
          </template>
          <div class="im-facelbl">全部表情</div>
          <div class="im-facegrid">
            <img v-for="id in faceIds" :key="id" :src="faceUrl(id)" loading="lazy"
              :title="faceName(id)" :alt="faceName(id)" @click="addFace(id)"
              @error="faceRetry" />
          </div>
        </div>

        <!-- @ 选择器 -->
        <div class="im-atpanel" v-if="showAt" @click.stop>
          <div class="im-atrow" v-for="p in people" :key="p.id" @click="addAt(p)">
            <img v-if="p.avatar" :src="p.avatar" alt="" />
            <div v-else class="ava-t">{{ (p.name || '?').slice(0, 1) }}</div>
            <span class="nm">{{ p.name || p.id }}</span>
            <span class="qq">{{ p.id }}</span>
          </div>
          <div class="im-empty" v-if="!people.length">本会话没有可 @ 的人</div>
        </div>
      </div>
    </div>

    <div class="im-menu" v-if="menu" :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
      @click.stop>
      <button @click="copyMsg(menu.m)">复制文字</button>
      <button @click="quoteMsg(menu.m)">引用</button>
      <button v-if="canRecall(menu.m)" @click="doRecall(menu.m)">撤回</button>
    </div>

    <div class="im-toast" v-if="toastMsg">{{ toastMsg }}</div>
  </div>`,
}
