<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GenericPlugin from './GenericPlugin.vue'
import LsMain from './laizhangsetu/LsMain.vue'
import TgMain from './touchgal/TgMain.vue'
import JmMain from './jmcomic/JmMain.vue'
import YtMain from './yulotool/YtMain.vue'
import FmMain from './filemanager/FmMain.vue'
import AiMain from './aigen/AIGen.vue'
import ToolboxMain from './toolbox/ToolboxMain.vue'
import UptimeMain from './uptime/UptimeMain.vue'
import DockerMain from './docker/DockerMain.vue'
import McServerMain from './mcserver/McServerMain.vue'
import McSkinMain from './mcskin/McSkinMain.vue'
import KvmMain from './kvm/KvmMain.vue'
import VpnMain from './vpn/VpnMain.vue'
import BackupMain from './backup/BackupMain.vue'

const MAP = {
  jmcomic: JmMain,
  laizhangsetu: LsMain,
  touchgal: TgMain,
  yulotool: YtMain,
  filemanager: FmMain,
  aigen: AiMain,
  toolbox: ToolboxMain,
  uptime: UptimeMain,
  docker: DockerMain,
  mcserver: McServerMain,
  mcskin: McSkinMain,
  kvm: KvmMain,
  vpn: VpnMain,
  backup: BackupMain,
}

const route = useRoute()
const router = useRouter()
const name = computed(() => String(route.params.name || ''))
const comp = computed(() => MAP[name.value] || GenericPlugin)
</script>

<template>
  <component :is="comp" :key="name" />
</template>
