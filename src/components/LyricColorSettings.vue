<script setup>
  import { reactive, watch } from 'vue'
  import { LYRIC_COLOR_OPTIONS } from '@/constants'
  import { useLyricColors } from '@/composables/useLyricColors'

  const { active, normal, colorStyle, setColor, resetColors } = useLyricColors()
  const fields = [
    { key: 'active', label: '当前行' },
    { key: 'normal', label: '普通行' }
  ]
  const colors = reactive({ active, normal })
  const drafts = reactive({
    active: active.value || '',
    normal: normal.value || ''
  })
  const errors = reactive({ active: false, normal: false })
  for (const { key } of fields) {
    watch(
      () => colors[key],
      value => {
        drafts[key] = value || ''
        errors[key] = false
      }
    )
  }

  function chooseColor(key, value) {
    if (!setColor(key, value)) return
    drafts[key] = colors[key] || ''
    errors[key] = false
  }

  function inputColor(key, value) {
    drafts[key] = value
    errors[key] = !setColor(key, value)
    if (!errors[key]) drafts[key] = colors[key]
  }

  function reset() {
    resetColors()
    for (const { key } of fields) {
      drafts[key] = ''
      errors[key] = false
    }
  }
</script>

<template>
  <div class="form-group lyric-color-settings">
    <div class="setting-copy">
      <h3 class="form-label">歌词颜色</h3>
      <p class="color-help">选色后自动保存，翻译与时间跟随所在行。</p>
    </div>
    <div class="color-controls">
      <fieldset v-for="field in fields" :key="field.key" class="color-field">
        <legend>{{ field.label }}</legend>
        <div class="color-choices">
          <button
            type="button"
            class="theme-choice"
            :aria-label="`${field.label}跟随主题`"
            :aria-pressed="colors[field.key] === null"
            @click="chooseColor(field.key, null)"
          >
            跟随主题
          </button>
          <button
            v-for="option in LYRIC_COLOR_OPTIONS"
            :key="option.value"
            type="button"
            class="color-swatch"
            :style="{ backgroundColor: option.value }"
            :aria-label="`${field.label}：${option.label}`"
            :title="`${option.label} ${option.value}`"
            :aria-pressed="colors[field.key] === option.value"
            @click="chooseColor(field.key, option.value)"
          ></button>
        </div>
        <div class="custom-color-row">
          <label class="picker-label" :for="`lyric-${field.key}-picker`">
            自定义
          </label>
          <input
            :id="`lyric-${field.key}-picker`"
            class="color-picker"
            type="color"
            :aria-label="`${field.label}自定义颜色`"
            :value="colors[field.key] || '#60A5FA'"
            @input="chooseColor(field.key, $event.target.value)"
          />
          <input
            :id="`lyric-${field.key}-hex`"
            class="color-hex"
            type="text"
            :aria-label="`${field.label}十六进制颜色`"
            :aria-invalid="errors[field.key]"
            :aria-describedby="
              errors[field.key]
                ? `lyric-${field.key}-error`
                : 'lyric-color-format'
            "
            :value="drafts[field.key]"
            placeholder="#RRGGBB"
            :spellcheck="false"
            autocomplete="off"
            @input="inputColor(field.key, $event.target.value)"
          />
        </div>
        <p
          v-if="errors[field.key]"
          :id="`lyric-${field.key}-error`"
          class="color-error"
          role="status"
        >
          请输入 #RRGGBB 格式的六位颜色，当前颜色未更改。
        </p>
      </fieldset>
      <p id="lyric-color-format" class="color-help">
        支持 #RRGGBB 色值；选择“跟随主题”可单独恢复。
      </p>
    </div>
    <div
      class="lyric-preview"
      :style="colorStyle"
      role="group"
      aria-label="歌词颜色预览"
    >
      <div class="preview-header">
        <span>歌词预览</span>
        <button type="button" class="reset-colors" @click="reset">
          恢复默认颜色
        </button>
      </div>
      <div class="preview-line">
        <span class="preview-time">00:12</span>
        <span>让旋律慢慢靠近</span>
        <span class="preview-translation">Let the melody draw near</span>
      </div>
      <div class="preview-line active">
        <span class="preview-time">00:18</span>
        <span>此刻，听见心里的声音</span>
        <span class="preview-translation">Hear the voice within</span>
      </div>
    </div>
    <p class="color-readability">
      自定义颜色在不同主题和封面背景下的可读性可能变化；可随时恢复跟随主题。
    </p>
  </div>
</template>

<style scoped>
  .form-label {
    color: var(--color-text);
    font-size: 14px;
    font-weight: 600;
  }
  .color-help,
  .color-readability {
    color: var(--color-text-secondary);
    font-size: 12px;
    line-height: 1.6;
  }
  .color-help {
    margin-top: 8px;
  }
  .color-controls {
    min-width: 0;
  }
  .color-field {
    border: 0;
    min-width: 0;
    padding: 0;
    margin: 0 0 20px;
  }
  .color-field legend {
    color: var(--color-text);
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 10px;
  }
  .color-choices,
  .custom-color-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .theme-choice,
  .reset-colors {
    min-height: 36px;
    padding: 6px 12px;
    border-radius: var(--radius-full);
    color: var(--color-text-secondary);
    background: var(--color-secondary-bg);
    font-size: 12px;
  }
  .theme-choice[aria-pressed='true'] {
    color: var(--color-accent-ink);
    background: var(--color-primary-bg);
  }
  .theme-choice:hover,
  .reset-colors:hover {
    color: var(--color-text);
    background: var(--color-secondary-bg-hover);
  }
  .color-swatch {
    width: 28px;
    height: 28px;
    border: 1px solid var(--color-border);
    border-radius: 50%;
  }
  .color-swatch[aria-pressed='true'] {
    outline: 2px solid var(--color-accent-ink);
    outline-offset: 3px;
  }
  .custom-color-row {
    margin-top: 12px;
  }
  .picker-label {
    color: var(--color-text-secondary);
    font-size: 12px;
  }
  .color-picker {
    width: 36px;
    height: 36px;
    padding: 2px;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .color-hex {
    width: 112px;
    min-width: 0;
    min-height: 36px;
    padding: 6px 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--surface-content);
    color: var(--color-text);
    font-size: 13px;
  }
  .color-hex[aria-invalid='true'] {
    border-color: var(--color-error);
  }
  .color-error {
    color: var(--color-text);
    font-size: 12px;
    line-height: 1.5;
    margin-top: 8px;
  }
  .lyric-preview,
  .color-readability {
    grid-column: 1 / -1;
  }
  .lyric-preview {
    padding: 16px 20px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-lg);
    background: var(--surface-content);
  }
  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: var(--color-text-secondary);
    font-size: 12px;
    margin-bottom: 16px;
  }
  .preview-line {
    color: var(--lyric-normal-color, var(--color-text-secondary));
    font-size: 18px;
    font-weight: 600;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }
  .preview-line + .preview-line {
    margin-top: 16px;
  }
  .preview-line.active {
    color: var(--lyric-active-color, var(--color-text));
  }
  .preview-time {
    font-size: 11px;
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    margin-right: 10px;
  }
  .preview-translation {
    display: block;
    font-size: 14px;
    font-weight: 400;
  }
</style>
