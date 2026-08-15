<script setup>
import { ref } from 'vue'
import VpnNodes from './VpnNodes.vue'
import VpnOverview from './VpnOverview.vue'
import VpnV2 from './VpnV2.vue'
import VpnWg from './VpnWg.vue'
import VpnOvpn from './VpnOvpn.vue'

const tab = ref('nodes')
const tabs = [
  { key: 'nodes', label: '节点' },
  { key: 'overview', label: '总览' },
  { key: 'subs', label: '订阅' },
  { key: 'wireguard', label: 'WireGuard' },
  { key: 'openvpn', label: 'OpenVPN' },
]
</script>

<template>
  <div class="app">
    <div class="app-screen">
      <div class="app-body">
        <VpnNodes v-if="tab === 'nodes'" />
        <VpnOverview v-else-if="tab === 'overview'" />
        <VpnV2 v-else-if="tab === 'subs'" />
        <VpnWg v-else-if="tab === 'wireguard'" />
        <VpnOvpn v-else />
      </div>
      <nav class="app-nav">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="nav-item"
          :class="{ active: tab === t.key }"
          @click="tab = t.key"
        >{{ t.label }}</button>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; height: 100vh; }
.app-screen {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.app-body { flex: 1; overflow-y: auto; padding: 16px 16px 8px; }
.app-nav {
  display: flex;
  border-top: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}
.nav-item {
  flex: 1;
  padding: 12px 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font);
  border-top: 2px solid transparent;
  transition: color var(--transition), border-color var(--transition);
}
.nav-item:hover { color: var(--text); }
.nav-item.active { color: var(--accent); border-top-color: var(--accent); }
</style>
