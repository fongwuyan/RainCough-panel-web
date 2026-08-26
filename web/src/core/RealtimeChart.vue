<script setup>
// RealtimeChart — 滚动时序折线图(复刻旧版: 宽高可配, 多系列, 无依赖纯 SVG)
import { computed } from 'vue'

const props = defineProps({
  series: { type: Array, default: () => [] }, // [{name, data:[], color}]
  max: { type: Number, default: 0 },          // 0=自动(按数据最大)
  height: { type: Number, default: 120 },
  width: { type: Number, default: 260 },
})

const viewW = computed(() => props.width)
const viewH = computed(() => props.height)

function linePath(series) {
  const data = series.data || []
  if (!data.length) return ''
  const maxV = props.max || Math.max(...data, 1)
  const step = viewW.value / (data.length - 1)
  let d = ''
  data.forEach((v, i) => {
    const x = i * step
    const y = viewH.value - Math.max(0, Math.min(100, (v / maxV) * 100)) / 100 * (viewH.value - 4) - 2
    d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1)
  })
  return d
}
</script>

<template>
  <svg class="rt-chart" :viewBox="`0 0 ${viewW} ${viewH}`" preserveAspectRatio="none"
    :style="{ height: props.height + 'px', width: '100%' }">
    <g v-for="(s, i) in series" :key="i">
      <path :d="linePath(s)" fill="none" :stroke="s.color || 'var(--accent)'" stroke-width="1.4" />
    </g>
    <template v-if="series.length === 0">
      <text :x="viewW / 2" :y="viewH / 2" text-anchor="middle" fill="var(--text-faint)" font-size="11">无数据</text>
    </template>
  </svg>
</template>

<style scoped>
.rt-chart { display: block; }
</style>