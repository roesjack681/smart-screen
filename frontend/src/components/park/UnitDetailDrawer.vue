<script setup lang="ts">
import { computed } from 'vue';
import PsIcon from '@/components/safety/PsIcon.vue';
import { useParkStore } from '@/stores/park';
import {
  OPERATION_STATE_LABEL,
  RISK_LEVEL_COLOR,
  RISK_LEVEL_LABEL,
} from '@/types/park';

const emit = defineEmits<{
  'goto-risk': [query?: Record<string, string>];
  'goto-ops': [query?: Record<string, string>];
}>();

const park = useParkStore();

const unit = computed(() => park.selectedUnit);
const zone = computed(() => park.selectedZone);
const zones = computed(() => (unit.value ? park.zonesOfUnit(unit.value.id) : []));
const timeline = computed(() => (unit.value ? park.unitTimeline(unit.value.id) : []));
const ops = computed(() => (unit.value ? park.relatedOperations(unit.value.id) : []));
const alarms = computed(() => (unit.value ? park.relatedAlarms(unit.value.id) : []));

const reviewHint = computed(() => {
  if (!unit.value) return '';
  if (unit.value.reviewStatus === 'pending') {
    return '涉及红区或重大升级事件：报警解除不自动恢复基础等级，须人工复核后恢复。';
  }
  if (unit.value.currentLevel !== unit.value.baseLevel) {
    return '当前动态等级高于固有等级；触发因素消除并确认后，可按规则恢复（演示）。';
  }
  return '当前无待复核事项；动态等级与固有等级一致或按已确认状态展示。';
});

function close(): void {
  park.selectUnit(null);
}

function openRules(): void {
  if (!unit.value) return;
  emit('goto-risk', { unitId: unit.value.id, focus: 'rules' });
}

function openOps(): void {
  if (!unit.value) return;
  emit('goto-ops', { unitId: unit.value.id });
}
</script>

<template>
  <Teleport to="body">
    <div v-if="park.drawerOpen && unit" class="ps-drawer-backdrop" @click.self="close">
      <aside class="park-unit-drawer" role="dialog" aria-label="风险单元详情">
        <header class="park-unit-drawer__head">
          <div>
            <p class="park-unit-drawer__eyebrow">风险单元详情 · 演示</p>
            <h2>{{ unit.name }}</h2>
            <span>
              {{ unit.id }} · {{ unit.area }}
              <template v-if="zone"> · 当前区域 {{ zone.name }}</template>
            </span>
          </div>
          <button class="ps-icon-button" type="button" aria-label="关闭" @click="close">
            <PsIcon name="X" :size="18" />
          </button>
        </header>

        <div class="park-unit-drawer__body">
          <div class="park-unit-drawer__levels">
            <div>
              <small>固有等级</small>
              <b :style="{ color: RISK_LEVEL_COLOR[unit.baseLevel] }">
                {{ RISK_LEVEL_LABEL[unit.baseLevel] }}
              </b>
            </div>
            <div>
              <small>当前动态等级</small>
              <b :style="{ color: RISK_LEVEL_COLOR[unit.currentLevel] }">
                {{ RISK_LEVEL_LABEL[unit.currentLevel] }}
              </b>
            </div>
            <div>
              <small>复核状态</small>
              <b>
                {{
                  unit.reviewStatus === 'pending'
                    ? '待复核'
                    : unit.reviewStatus === 'done'
                      ? '已复核'
                      : '无需复核'
                }}
              </b>
            </div>
          </div>

          <section>
            <h3>建筑内独立区域</h3>
            <ul class="park-unit-drawer__zones">
              <li
                v-for="z in zones"
                :key="z.id"
                :class="{ active: z.id === park.selectedZoneId, alarmed: park.alarmedZoneIds.has(z.id) }"
                @click="park.selectZone(z.id, true)"
              >
                <i :style="{ background: RISK_LEVEL_COLOR[z.currentLevel] }" />
                <div>
                  <strong>{{ z.name }}</strong>
                  <span>{{ z.id }} · {{ RISK_LEVEL_LABEL[z.currentLevel] }}</span>
                </div>
                <em v-if="park.alarmedZoneIds.has(z.id)">告警</em>
              </li>
            </ul>
          </section>

          <section>
            <h3>触发原因</h3>
            <ul v-if="unit.triggers.length" class="park-unit-drawer__list">
              <li v-for="(t, i) in unit.triggers" :key="i">{{ t }}</li>
            </ul>
            <p v-else class="park-unit-drawer__empty">当前无激活触发因素</p>
            <p class="park-unit-drawer__hint">
              触发因素数量 {{ unit.triggers.length }} · 多因素取最高幅度，封顶红区（M5 口径演示）
            </p>
            <button class="ps-link-button park-unit-drawer__link" type="button" @click="openRules">
              查看规则口径（动态风险占位）
            </button>
          </section>

          <section>
            <h3>复核与恢复</h3>
            <p class="park-unit-drawer__hint">{{ reviewHint }}</p>
          </section>

          <section>
            <h3>关联危险作业</h3>
            <ul v-if="ops.length" class="park-unit-drawer__list">
              <li v-for="op in ops" :key="op.id">
                <strong>{{ op.name }}</strong>
                <span>{{ OPERATION_STATE_LABEL[op.actualState] }} · {{ op.type }}</span>
              </li>
            </ul>
            <p v-else class="park-unit-drawer__empty">暂无关联作业</p>
            <button class="ps-link-button park-unit-drawer__link" type="button" @click="openOps">
              在危险作业页查看（占位承接）
            </button>
          </section>

          <section>
            <h3>关联告警</h3>
            <ul v-if="alarms.length" class="park-unit-drawer__list">
              <li
                v-for="al in alarms"
                :key="al.id"
                class="park-unit-drawer__alarm"
                @click="park.selectZone(al.zoneId, true)"
              >
                <strong>{{ al.type }}</strong>
                <span>{{ al.location }}</span>
                <span>{{ al.occurredAt }} · {{ al.summary }}</span>
              </li>
            </ul>
            <p v-else class="park-unit-drawer__empty">暂无关联告警</p>
          </section>

          <section>
            <h3>时间线</h3>
            <div class="ps-timeline">
              <div v-for="item in timeline" :key="item.id" class="done">
                <i />
                <h4>
                  {{ item.title }}
                  <time>{{ item.at }}</time>
                </h4>
                <p>{{ item.detail }}</p>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.park-unit-drawer {
  height: 100dvh;
  width: 420px;
  max-width: 100%;
  border-left: 1px solid #315d75;
  background: linear-gradient(160deg, #102b41, #0a1c2c);
  box-shadow: -20px 0 100px #02091077;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.park-unit-drawer::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.park-unit-drawer__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 22px 22px 16px;
  border-bottom: 1px solid #234154;
}

.park-unit-drawer__eyebrow {
  font-size: 10px;
  color: #6f92a7;
  letter-spacing: 1px;
  margin-bottom: 6px !important;
}

.park-unit-drawer__hint {
  margin-top: 8px;
  font-size: 11px;
  line-height: 1.5;
  color: #8fafc2;
}

.park-unit-drawer__link {
  margin-top: 8px;
  font-size: 12px;
}

.park-unit-drawer__head h2 {
  font-size: 18px;
  color: #d9edf5;
}

.park-unit-drawer__head span {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  color: #6c90a5;
}

.park-unit-drawer__body {
  padding: 18px 22px 28px;
}

.park-unit-drawer__levels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

.park-unit-drawer__levels > div {
  background: #0c2233;
  border: 1px solid #25485c;
  border-radius: 4px;
  padding: 12px;
}

.park-unit-drawer__levels > div:last-child {
  grid-column: 1 / -1;
}

.park-unit-drawer__levels small {
  display: block;
  color: #6f91a6;
  font-size: 10px;
  margin-bottom: 6px;
}

.park-unit-drawer__levels b {
  font-size: 14px;
  font-weight: 500;
  color: #cfe4ef;
}

.park-unit-drawer__body section {
  margin-bottom: 20px;
}

.park-unit-drawer__body h3 {
  font-size: 12px;
  color: #8fb0c3;
  margin-bottom: 10px;
  letter-spacing: 0.5px;
}

.park-unit-drawer__zones {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.park-unit-drawer__zones li {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  border: 1px solid #243f52;
  background: #0d2233;
  border-radius: 4px;
  padding: 10px 12px;
  cursor: pointer;
}

.park-unit-drawer__zones li:hover,
.park-unit-drawer__zones li.active {
  border-color: #3d7f98;
}

.park-unit-drawer__zones li.alarmed {
  border-color: #f0525266;
}

.park-unit-drawer__zones i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.park-unit-drawer__zones strong {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #d7ebf4;
}

.park-unit-drawer__zones span {
  display: block;
  margin-top: 3px;
  font-size: 10px;
  color: #6f91a6;
}

.park-unit-drawer__zones em {
  font-style: normal;
  font-size: 10px;
  color: #f05252;
}

.park-unit-drawer__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.park-unit-drawer__list li,
.park-unit-drawer__alarm {
  border: 1px solid #243f52;
  background: #0d2233;
  border-radius: 4px;
  padding: 10px 12px;
  font-size: 12px;
  color: #b7cfdc;
}

.park-unit-drawer__alarm {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.park-unit-drawer__alarm:hover {
  border-color: #3d7f98;
}

.park-unit-drawer__list strong,
.park-unit-drawer__alarm strong {
  display: block;
  font-weight: 500;
  color: #d7ebf4;
}

.park-unit-drawer__list span,
.park-unit-drawer__alarm span {
  display: block;
  font-size: 11px;
  color: #6f91a6;
}

.park-unit-drawer__empty {
  font-size: 11px;
  color: #5d8198;
}
</style>
