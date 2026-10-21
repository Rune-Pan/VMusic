import { reactive, toRefs } from 'vue'
import { STORAGE_KEYS } from '@/constants'

const defaults = { enabled: false, secondsPerTurn: 8 }

function normalize(value) {
  return {
    enabled: typeof value?.enabled === 'boolean' ? value.enabled : defaults.enabled,
    secondsPerTurn:
      Number.isInteger(value?.secondsPerTurn) && value.secondsPerTurn >= 5 &&
      value.secondsPerTurn <= 60 ? value.secondsPerTurn : defaults.secondsPerTurn
  }
}

function restore() {
  try {
    return normalize(JSON.parse(localStorage.getItem(STORAGE_KEYS.COVER_ROTATION)))
  } catch {
    return { ...defaults }
  }
}

const preferences = reactive(restore())
function update(patch) {
  Object.assign(preferences, normalize({ ...preferences, ...patch }))
  localStorage.setItem(STORAGE_KEYS.COVER_ROTATION, JSON.stringify(preferences))
}

export function useCoverRotation() {
  return {
    ...toRefs(preferences),
    setEnabled: value => update({ enabled: value }),
    setSecondsPerTurn: value => update({ secondsPerTurn: value })
  }
}
