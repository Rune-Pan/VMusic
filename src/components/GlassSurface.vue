<script setup>
  import { ref, useId, onMounted, onUnmounted } from 'vue'
  import { createLensMap } from '@/utils/glass'
  import { useDialogFocus } from '@/composables/useDialogFocus'

  const props = defineProps({
    as: { type: String, default: 'div' },
    modal: { type: Boolean, default: false },
    label: { type: String, default: '' }
  })
  const surface = ref(null)
  useDialogFocus(surface, () => props.modal)
  const map = ref('')
  const filterId = `lens-${useId().replace(/:/g, '')}`
  let observer
  let resizeFrame = 0
  let pointerFrame = 0
  let motionQuery
  let transparencyQuery

  function updateMap() {
    cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(() => {
      if (transparencyQuery?.matches) {
        map.value = ''
        return
      }
      const rect = surface.value?.getBoundingClientRect()
      if (rect?.width && rect.height)
        map.value = createLensMap(
          rect.width,
          rect.height,
          parseFloat(getComputedStyle(surface.value).borderTopLeftRadius)
        )
    })
  }

  function moveLight(event) {
    if (motionQuery?.matches || transparencyQuery?.matches || pointerFrame)
      return
    const element = surface.value
    const rect = element.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100
    pointerFrame = requestAnimationFrame(() => {
      element.style.setProperty('--glass-light-x', `${x}%`)
      element.style.setProperty('--glass-light-y', `${y}%`)
      pointerFrame = 0
    })
  }

  onMounted(() => {
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    transparencyQuery = window.matchMedia(
      '(prefers-reduced-transparency: reduce)'
    )
    const chromium = /(?:Chrome|Chromium|Edg)\//.test(navigator.userAgent)
    if (!chromium || !CSS.supports('backdrop-filter', 'url("#lens")')) return
    observer = new ResizeObserver(updateMap)
    observer.observe(surface.value)
    transparencyQuery.addEventListener('change', updateMap)
  })

  onUnmounted(() => {
    observer?.disconnect()
    cancelAnimationFrame(resizeFrame)
    cancelAnimationFrame(pointerFrame)
    transparencyQuery?.removeEventListener('change', updateMap)
  })
</script>

<template>
  <component
    :is="as"
    ref="surface"
    :role="modal ? 'dialog' : undefined"
    :aria-modal="modal ? true : undefined"
    :aria-label="modal ? label : undefined"
    :tabindex="modal ? -1 : undefined"
    class="glass-surface"
    :class="{ 'has-refraction': map }"
    :style="map ? { '--glass-filter': `url(#${filterId})` } : undefined"
    @pointermove="moveLight"
  >
    <svg v-if="map" class="glass-defs" aria-hidden="true" width="0" height="0">
      <defs>
        <filter
          :id="filterId"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          color-interpolation-filters="sRGB"
        >
          <feImage
            :href="map"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            result="lens-map"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="lens-map"
            scale="32"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
    <span class="glass-optics" aria-hidden="true"></span>
    <slot />
  </component>
</template>

<style>
  /* Web approximation, not Apple's native Liquid Glass API. */
  .glass-surface {
    position: relative;
    isolation: isolate;
    border-radius: var(--radius-glass);
    border: 1px solid var(--glass-border);
    box-shadow:
      var(--shadow-glass),
      inset 0 1px 0 var(--glass-highlight);
    background: transparent;
  }
  .glass-defs {
    position: absolute;
    pointer-events: none;
  }
  .glass-optics {
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: inherit;
    pointer-events: none;
    background: var(--glass-solid);
  }
  @supports (backdrop-filter: blur(1px)) {
    .glass-optics {
      background: var(--glass-tint);
      backdrop-filter: blur(22px) saturate(155%);
    }
    .has-refraction > .glass-optics {
      backdrop-filter: var(--glass-filter) blur(7px) saturate(145%);
    }
  }
  .glass-optics::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background:
      radial-gradient(
        ellipse at var(--glass-light-x, 15%) var(--glass-light-y, 0%),
        var(--glass-highlight),
        transparent 48%
      ),
      linear-gradient(
        135deg,
        rgb(255 255 255 / 0.18),
        transparent 38%,
        rgb(255 255 255 / 0.06)
      );
    box-shadow:
      inset 0 0 0 1px var(--glass-inner-border),
      inset 0 -1px 0 var(--glass-highlight);
  }
  @media (prefers-reduced-transparency: reduce) {
    .glass-surface > .glass-optics {
      background: var(--glass-solid);
      backdrop-filter: none;
    }
    .glass-optics::after {
      background: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .glass-optics::after {
      background: linear-gradient(
        135deg,
        var(--glass-highlight),
        transparent 60%
      );
    }
  }
</style>
