<script setup>
import { computed } from 'vue'
import TrendPanel from './TrendPanel.vue'
import DeviceCards from './DeviceCards.vue'
import PsIcon from './PsIcon.vue'
import { formatDate, formatTime } from '@/utils/safety/format'

const props = defineProps({ store: Object, view: { type: String, default: 'overview' } })
const emit = defineEmits(['navigate', 'rules', 'details', 'maintenance'])
const active = props.store.activeAlarms
const pendingCount = computed(() => active.value.filter((a) => !a.acknowledgedAt).length)
const recent = computed(() =>
  [...props.store.state.alarms]
    .sort((a, b) => (!!b.resolvedAt === !!a.resolvedAt ? b.startedAt - a.startedAt : a.resolvedAt ? 1 : -1))
    .slice(0, 4),
)
const pendingOrders = computed(() => props.store.state.orders.filter((o) => o.status !== 'completed'))
</script>

<template>
  <div class="ps-content">
    <template v-if="view === 'overview'">
      <div class="ps-overview-top">
        <TrendPanel :store="store" @rules="emit('rules')" />
        <section class="ps-panel ps-events-panel">
          <header class="ps-panel-header">
            <h2>
              <span class="ps-section-mark"></span>
              ????
              <span class="ps-count" :class="{ hot: pendingCount }">{{ pendingCount }} ???</span>
            </h2>
          </header>
          <div class="ps-feed">
            <button
              v-for="alarm in recent"
              :key="alarm.id"
              class="ps-feed-item"
              @click="emit('details', alarm)"
            >
              <span :class="['ps-feed-icon', alarm.resolvedAt ? 'resolved' : alarm.severity]">
                <PsIcon :name="alarm.resolvedAt ? 'CircleCheck' : 'BellRing'" :size="17" />
              </span>
              <div>
                <div class="ps-feed-title">
                  <b>{{ alarm.title }}</b>
                  <time>{{ formatTime(alarm.startedAt, false) }}</time>
                </div>
                <p>{{ alarm.deviceName }} <span>? {{ alarm.area }}</span></p>
                <div class="ps-feed-bottom">
                  <span>{{ alarm.reading }}</span>
                  <span :class="['ps-feed-state', alarm.resolvedAt ? 'resolved' : alarm.severity]">
                    {{ alarm.resolvedAt ? '???' : alarm.acknowledgedAt ? '???' : '???' }}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </section>
      </div>

      <div class="ps-overview-bottom">
        <DeviceCards :store="store" />
        <section class="ps-panel ps-maintenance-summary">
          <header class="ps-panel-header">
            <h2>
              <span class="ps-section-mark"></span>
              ????
              <small>{{ pendingOrders.length }} ???</small>
            </h2>
            <button class="ps-link-button" @click="emit('navigate', 'maintenance')">
              ?? <PsIcon name="ArrowUpRight" :size="14" />
            </button>
          </header>
          <button
            v-for="order in pendingOrders.slice(0, 2)"
            :key="order.id"
            class="ps-maintenance-brief"
            @click="emit('navigate', 'maintenance')"
          >
            <span class="ps-maintenance-icon"><PsIcon name="Wrench" :size="19" /></span>
            <div>
              <b>{{ order.title }}</b>
              <p>
                {{ store.state.devices.find((d) => d.id === order.deviceId)?.name }} ? {{ order.owner }}
              </p>
            </div>
            <div class="ps-maintenance-date">
              <b
                :class="
                  formatDate(order.plannedAt) === formatDate(store.state.time) ? 'ps-text-amber' : ''
                "
              >
                {{
                  formatDate(order.plannedAt) === formatDate(store.state.time)
                    ? '??'
                    : formatDate(order.plannedAt).slice(5)
                }}
              </b>
              <small>{{ order.status === 'inprogress' ? '???' : '???' }}</small>
            </div>
          </button>
          <div v-if="!pendingOrders.length" class="ps-empty ps-empty-small">?????????</div>
          <div class="ps-maintenance-footer">
            <span class="ps-dot"></span>
            ???????????
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
