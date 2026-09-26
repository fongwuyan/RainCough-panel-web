<script setup>
import { computed, ref, onErrorCaptured } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GenericPlugin from './GenericPlugin.vue'
import LsMain from './laizhangsetu/LsMain.vue'
import TgMain from './touchgal/TgMain.vue'
import JmMain from './jmcomic/JmMain.vue'
import FmMain from './filemanager/FmMain.vue'
import AiMain from './aigen/AIGen.vue'
import UptimeMain from './uptime/UptimeMain.vue'
import DockerMain from './docker/DockerMain.vue'
import McServerMain from './mcserver/McServerMain.vue'
import McSkinMain from './mcskin/McSkinMain.vue'
import KvmMain from './kvm/KvmMain.vue'
import VpnMain from './vpn/VpnMain.vue'

const MAP = {
  jmcomic: JmMain,
  laizhangsetu: LsMain,
  touchgal: TgMain,
  filemanager: FmMain,
  aigen: AiMain,
  uptime: UptimeMain,
  docker: DockerMain,
  mcserver: McServerMain,
  mcskin: McSkinMain,
  kvm: KvmMain,
  vpn: VpnMain,}

const route = useRoute()
const router = useRouter()
const name = computed(() => String(route.params.name || ''))
const perr = ref('')
onErrorCaptured((e) => { perr.value = String((e && (e.message || e)) || e) })
const comp = computed(() => MAP[name.value] || GenericPlugin)
</script>

<template>
  <div v-if="perr" style="background:#7a1f1f;color:#fff;padding:10px 14px;margin:10px;font-size:12px;font-family:monospace">插件页错误: {{ perr }}</div>
  <component :is="comp" :key="name" />
</template>
