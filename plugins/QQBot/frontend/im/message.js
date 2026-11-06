// 消息行与气泡渲染
//
// ★ 设计原则：**未知类型不丢**。认不出的段落到 [类型] 占位，
//   卡片类尽量解析出标题，解析失败也不报错。
import {
  fmtClock, mediaUrl, mediaAlive, faceUrl, bytes, gridCls,
  partsOf, groupMedia, voiceWidth, guessSec,
} from './util.js'
import { isMe } from './store.js'

// 全局唯一的播放器：同一时刻只有一条语音在响
let AUDIO = null

/** 卡片类消息：json / xml / forward 尽量抽出标题与描述 */
function cardInfo(segs) {
  for (const s of (segs || [])) {
    const t = s && s.type
    const d = (s && s.data) || {}
    if (t === 'json') {
      try {
        const o = JSON.parse(d.data)
        const m = o.meta || {}
        const title = o.prompt || (m.detail && m.detail.title) || (m.news && m.news.title) || '卡片消息'
        const desc = (m.detail && m.detail.desc) || m.desc || ''
        const jump = (m.news && m.news.jumpUrl) || (m.detail && m.detail.qqdocurl) || ''
        return { kind: 'card', title, desc, jump }
      } catch (e) {
        return { kind: 'card', title: '卡片消息', desc: '', jump: '' }
      }
    }
    if (t === 'xml') {
      return { kind: 'card', title: '卡片消息', desc: String(d.data || '').slice(0, 90), jump: '' }
    }
    if (t === 'forward' || t === 'node') {
      return { kind: 'forward', title: '合并转发', desc: '点击查看（下一阶段支持展开）', jump: '' }
    }
  }
  return null
}

export const ImVoice = {
  props: { m: Object, me: Boolean },
  data() { return { playing: false } },
  computed: {
    sec() { return guessSec(this.m) },
    w() { return voiceWidth(this.sec) },
    src() { return mediaUrl(this.m) },
    bars() {
      // 固定波形，只求观感（真实波形需要解码音频，P2 再做）
      const s = this.sec
      const n = Math.max(6, Math.min(22, Math.round(s * 1.6)))
      const out = []
      for (let i = 0; i < n; i++) out.push(6 + Math.round(Math.abs(Math.sin(i * 1.7 + s)) * 12))
      return out
    },
  },
  beforeUnmount() { this.stop() },
  methods: {
    stop() {
      if (AUDIO) { try { AUDIO.pause() } catch (e) {} }
      this.playing = false
    },
    toggle() {
      if (!this.src) return
      if (this.playing) { this.stop(); return }
      if (AUDIO) { try { AUDIO.pause() } catch (e) {} }
      AUDIO = new Audio(this.src)
      AUDIO.onended = () => { this.playing = false }
      AUDIO.onerror = () => { this.playing = false }
      AUDIO.play().then(() => { this.playing = true }).catch(() => { this.playing = false })
    },
  },
  template: `
  <div class="im-voice" :style="{ width: w + 'px' }" @click="toggle" :title="playing ? '停止' : '播放语音'">
    <span class="wave">
      <i v-for="(h,i) in bars" :key="i" :style="{ height: h + 'px', opacity: playing ? .95 : .5 }"></i>
    </span>
    <span class="sec">{{ sec }}"</span>
  </div>`,
}

export const ImMessageRow = {
  components: { ImVoice },
  props: { m: Object, compact: Boolean, showTime: String },
  data() { return { viewer: '', badAva: false } },
  computed: {
    me() { return isMe(this.m) },
    recalled() { return !!this.m.recalled },
    parsed() { return partsOf(this.m) },
    parts() { return this.parsed.parts },
    quote() {
      // 后端已把 reply 段解析成 {sender, text}；没有就退回占位文案
      const q = this.m && this.m.quote
      if (q && (q.sender || q.text)) {
        return (q.sender ? q.sender + '：' : '') + (q.text || '[消息]')
      }
      return this.parsed.quote
    },
    media() { return this.m.media || [] },
    groups() { return groupMedia(this.media) },
    card() { return cardInfo(this.m.segs) },
    hasMedia() { return !!(this.groups.image.length || this.groups.video.length || this.groups.record.length || this.groups.file.length) },
    mediaOnly() { return !this.quote && !this.parts.filter((p) => p.t !== 'face').length && this.hasMedia },
    name() { return this.m.sender_name || this.m.sender_id || '未知' },
    avatar() {
      if (this.m.sender_avatar) return this.m.sender_avatar
      const id = String(this.m.sender_id || '')
      return /^\d{5,12}$/.test(id) ? 'https://q1.qlogo.cn/g?b=qq&nk=' + id + '&s=100' : ''
    },
    time() { return fmtClock(this.m.created_at) },
    initial() { return String(this.name || '?').trim().slice(0, 1) },
    showAva() { return !!this.avatar && !this.badAva },
    images() { return this.groups.image.filter(mediaAlive) },
    videos() { return this.groups.video.filter(mediaAlive) },
    voices() { return this.groups.record.filter(mediaAlive) },
    files() { return this.groups.file.filter(mediaAlive) },
  },
  methods: {
    faceUrl, mediaUrl, bytes, gridCls, mediaAlive,
    openImg(m) { this.viewer = mediaUrl(m) },
    faceErr(e) { const el = e && e.target; if (el) el.style.visibility = 'hidden' },
  },
  template: `
  <div>
    <div class="im-time" v-if="showTime">{{ showTime }}</div>
    <div class="im-msg" :class="{ me: me, compact: compact }">
      <div class="ava" :class="{ ph: compact }">
        <img v-if="showAva && !compact" :src="avatar" alt="" @error="badAva = true" />
        <div v-else-if="!compact" class="ava-t">{{ initial }}</div>
      </div>
      <div class="col">
        <div class="who" v-if="!compact && !me">{{ name }}</div>

        <div class="im-bub" :class="{ media: mediaOnly }">
          <div class="im-recall" v-if="recalled">该消息已被撤回</div>
          <template v-else>
            <div class="im-quote" v-if="quote" :title="quote">{{ quote }}</div>

            <div v-if="card" class="im-card">
              <div class="ct">{{ card.title }}</div>
              <div class="cd" v-if="card.desc">{{ card.desc }}</div>
            </div>

            <span v-for="(p,i) in parts" :key="i">
              <span v-if="p.t === 'text'">{{ p.v }}</span>
              <span v-else-if="p.t === 'at'" class="at">{{ p.v }}</span>
              <img v-else-if="p.t === 'face'" class="face" :src="faceUrl(p.v)" alt="[表情]" @error="faceErr" />
              <span v-else class="im-unk">[{{ p.name }}]</span>
            </span>
          </template>
        </div>

        <!-- 媒体区（放在气泡外，避免圆角与内边距打架） -->
        <div class="im-grid" :class="gridCls(images.length)" v-if="images.length">
          <img v-for="(m,i) in images" :key="i" :src="mediaUrl(m)" loading="lazy"
            @click="openImg(m)" alt="图片" />
        </div>
        <div class="im-video" v-for="(m,i) in videos" :key="'v'+i">
          <video :src="mediaUrl(m)" controls preload="metadata" playsinline></video>
        </div>
        <div class="im-bub" v-for="(m,i) in voices" :key="'r'+i" style="padding:6px 10px">
          <im-voice :m="m" :me="me" />
        </div>
        <div class="im-bub" v-for="(m,i) in files" :key="'f'+i" style="padding:8px 12px">
          <div class="im-file">
            <div class="fi">{{ (m.name || 'FILE').split('.').pop().slice(0,4).toUpperCase() }}</div>
            <div style="min-width:0">
              <div style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                {{ m.name || '文件' }}</div>
              <div style="font-size:11px;color:var(--im-t3)">{{ bytes(m.bytes) }}</div>
            </div>
            <a :href="mediaUrl(m)" :download="m.name || true" style="margin-left:8px;font-size:12px">下载</a>
          </div>
        </div>

        <div class="im-meta" v-if="!compact">
          <span v-if="m._pending">发送中…</span>
          <span v-else-if="m._failed" class="im-st-bad" title="点击重发"
            @click="$emit('retry', m)">发送失败，点击重试</span>
          <span v-else>{{ time }}</span>
        </div>
      </div>
    </div>

    <div class="im-viewer" v-if="viewer" @click.self="viewer = ''">
      <button class="x" @click="viewer = ''">×</button>
      <img :src="viewer" alt="" />
    </div>
  </div>`,
}
