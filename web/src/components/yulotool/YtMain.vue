<script setup>
import { ref } from 'vue'
import DcMain from '../decompress/DcMain.vue'
import DaMain from '../diranalyze/DaMain.vue'
import HashMain from '../hash/HashMain.vue'
import MtMain from '../mediatools/MtMain.vue'
import DocMain from '../docconvert/DocMain.vue'
import NtMain from '../networktools/NtMain.vue'
import VmMain from '../videomerge/VmMain.vue'

const tab = ref('decompress')
const tabs = [
  { key: 'decompress', label: '解压压缩', comp: DcMain },
  { key: 'diranalyze', label: '目录分析', comp: DaMain },
  { key: 'hash', label: '文件哈希', comp: HashMain },
  { key: 'mediatools', label: '媒体工具', comp: MtMain },
  { key: 'docconvert', label: '文档转换', comp: DocMain },
  { key: 'networktools', label: '网络工具', comp: NtMain },
  { key: 'videomerge', label: '视频融合', comp: VmMain },
]
</script>

<template>
  <div>
    <h1>工具箱</h1>
    <div class="subtitle">解压压缩、目录分析、哈希、媒体处理、文档转换、网络工具、视频融合</div>

    <div class="tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ active: tab === t.key }"
        @click="tab = t.key"
      >{{ t.label }}</button>
    </div>

    <component :is="tabs.find(t => t.key === tab).comp" :key="tab" />
  </div>
</template>
