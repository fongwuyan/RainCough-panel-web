<script setup>
import { usePreview } from '../stores/preview'

const preview = usePreview()
</script>

<template>
  <transition name="fade">
    <div v-if="preview.show.value" class="lightbox" @click="preview.close()">
      <div class="lightbox-bar">
        <span class="lightbox-counter">{{ preview.index.value + 1 }} / {{ preview.count.value }}</span>
        <button class="lightbox-close" @click.stop="preview.close()">关闭</button>
      </div>
      <button v-if="preview.count.value > 1" class="lightbox-nav prev" @click.stop="preview.prev()">上一张</button>
      <img :src="preview.current.value" alt="preview" @click.stop="preview.next()" />
      <button v-if="preview.count.value > 1" class="lightbox-nav next" @click.stop="preview.next()">下一张</button>
    </div>
  </transition>
</template>
