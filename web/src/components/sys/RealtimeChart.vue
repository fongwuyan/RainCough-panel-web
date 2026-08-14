<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  series: { type: Array, default: () => [] }, // [{ name, data, color }]
  height: { type: Number, default: 140 },
  min: { type: [Number, null], default: null },
  max: { type: [Number, null], default: null },
  unit: { type: String, default: '' },
})

const W = 600
const PAD = 4
const BOTTOM = 4

const hidden = ref([])

function isHidden(i) { return hidden.value.includes(i) }

function show(i) { hidden.value = hidden.value.filter(x => x !== i) }
function hide(i) { if (!hidden.value.includes(i)) hidden.value = [...hidden.value, i] }

const liveSeries = computed(() => props.series.filter((_, i) => !isHidden(i)))
const maxVal = computed(() => {
  if (props.max != null) return props.max
  let m = 0
  for (const s of liveSeries.value) {
    for (const v of s.data) { if (v > m) m = v }
  }
  return m || 1
})

function yPos(v) {
  if (maxVal.value <= 0) return PAD
  return PAD + (1 - v / maxVal.value) * (props.height - PAD - BOTTOM)
}

function points(s) {
  const n = s.data.length
  if (!n) return ''
  const step = n > 1 ? (W - PAD * 2) / (n - 1) : 0
  return s.data.map((v, i) => {
    const x = PAD + i * step
    return `${x.toFixed(1)},${yPos(v).toFixed(1)}`
  }).join(' ')
}

function areaPoly(s) {
  const pts = points(s)
  if (!pts) return ''
  const n = s.data.length
  const step = n > 1 ? (W - PAD * 2) / (n - 1) : 0
  const lastX = (PAD + (n - 1) * step).toFixed(1)
  return `${pts} ${lastX},${(props.height - BOTTOM).toFixed(1)} ${PAD},${(props.height - BOTTOM).toFixed(1)}`
}

const refLines = computed(() => {
  const lines = []
  const ticks = [0, 0.5, 1]
  for (const t of ticks) {
    lines.push({ pct: t, y: yPos(maxVal.value * t) })
  }
  return lines
})
</script>

<template>
  <div class="rchart">
    <svg :viewBox="`0 0 ${W} ${height}`" preserveAspectRatio="none"
         :style="{ height: height + 'px', width: '100%' }">
      <line v-for="(l, i) in refLines" :key="i" :x1="0" :x2="W" :y1="l.y" :y2="l.y"
            class="rchart-grid" />
      <template v-for="(s, i) in liveSeries" :key="s.name + i">
        <polygon v-if="s.data.length > 1" :points="areaPoly(s)" :fill="s.color" fill-opacity="0.15" />
        <polyline :points="points(s)" fill="none" :stroke="s.color" stroke-width="1.5" class="rchart-line" />
      </template>
    </svg>
    <div v-if="series.length > 1" class="rchart-legend">
      <span v-for="(s, i) in series" :key="s.name" class="rchart-legend-item"
            :class="{ off: isHidden(i) }" @click="isHidden(i) ? show(i) : hide(i)">
        <i :style="{ background: s.color }"></i>{{ s.name }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.rchart { width: 100%; }
.rchart svg { display: block; background: var(--bg); border: 1px solid var(--border); }
.rchart-line { pointer-events: none; }
.rchart-grid { stroke: var(--border); stroke-width: 1; }
.rchart-legend {
  display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px;
  font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);
}
.rchart-legend-item { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; opacity: .9; }
.rchart-legend-item i { width: 8px; height: 8px; display: inline-block; }
.rchart-legend-item:hover { color: var(--text); }
.rchart-legend-item.off { opacity: .35; text-decoration: line-through; }
</style>