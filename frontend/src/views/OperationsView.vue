<script setup lang="ts">
import { computed, ref } from 'vue';
import PsIcon from '@/components/safety/PsIcon.vue';
import UnitDetailDrawer from '@/components/park/UnitDetailDrawer.vue';
import { useParkStore } from '@/stores/park';
import {
  OPERATION_STATE_LABEL,
  RISK_LEVEL_COLOR,
  RISK_LEVEL_LABEL,
  type OperationState,
  type ParkOperation,
  type RiskLevel,
} from '@/types/park';

const emit = defineEmits<{ navigate: [view: string] }>();
const park = useParkStore();
const activeFilter = ref<'all' | OperationState>('all');
const search = ref('');

const stateOrder: Array<'all' | OperationState> = ['all', 'ongoing', 'pending', 'paused', 'completed'];
const stateLabels: Record<'all' | OperationState, string> = { all: '全部作业', ongoing: '进行中', pending: '待开工', paused: '已暂停', completed: '已完成' };
const levelByState: Record<OperationState, RiskLevel> = { ongoing: 'orange', pending: 'yellow', paused: 'orange', completed: 'blue' };

const stateCounts = computed(() => {
  const counts: Record<OperationState, number> = { pending: 0, ongoing: 0, paused: 0, completed: 0 };
  for (const op of park.operations) counts[op.actualState] += 1;
  return counts;
});

const filteredOperations = computed(() => {
  const q = search.value.trim().toLowerCase();
  return park.operations.filter((op) => {
    const unit = park.units.find((item) => item.id === op.unitId);
    const stateMatch = activeFilter.value === 'all' || op.actualState === activeFilter.value;
    const textMatch = !q || `${op.name} ${op.type} ${unit?.name || ''} ${op.summary}`.toLowerCase().includes(q);
    return stateMatch && textMatch;
  });
});

const ongoing = computed(() => park.operations.filter((op) => op.actualState === 'ongoing'));
const ongoingUnitCount = computed(() => new Set(ongoing.value.map((op) => op.unitId)).size);
const auditSteps = [
  { label: '作业信息与作业时段', state: 'pass', detail: '已填写作业地点与计划时间' },
  { label: '安全措施与应急要求', state: 'attention', detail: '需补充现场应急措施说明' },
  { label: '作业人员与监护资质', state: 'attention', detail: '请核验资质原件及有效期' },
  { label: '分级审批与现场确认', state: 'pending', detail: '待属地与安全管理人员确认' },
] as const;

function unitName(op: ParkOperation): string {
  return park.units.find((unit) => unit.id === op.unitId)?.name || '未关联单元';
}

function unitLevel(op: ParkOperation): RiskLevel {
  return park.units.find((unit) => unit.id === op.unitId)?.currentLevel || levelByState[op.actualState];
}

function operationRiskClass(op: ParkOperation): { label: string; state: 'high' | 'condition' | 'confirm' } {
  if (['有限空间', '吊装', '熏蒸杀虫', '拆除'].includes(op.type)) return { label: '高风险', state: 'high' };
  if (op.type === '动火') return { label: '按环境判级', state: 'condition' };
  return { label: '参数待确认', state: 'confirm' };
}

function openUnit(op: ParkOperation): void {
  park.selectUnit(op.unitId);
}

function timeRange(op: ParkOperation): string {
  const date = op.plannedStart.slice(5, 10).replace('-', '/');
  return `${date} ${op.plannedStart.slice(11, 16)}–${op.plannedEnd.slice(11, 16)}`;
}
</script>

<template>
  <div class="operations-dashboard">
    <section class="operations-kpis" aria-label="危险作业统计">
      <article class="operations-kpi operations-kpi--total">
        <span class="operations-kpi__icon"><PsIcon name="ClipboardList" :size="18" /></span>
        <div><small>在册作业总数</small><strong>{{ park.operations.length }}<em>项</em></strong></div>
        <span class="operations-kpi__note">演示台账</span>
      </article>
      <article class="operations-kpi operations-kpi--active">
        <span class="operations-kpi__icon"><PsIcon name="Activity" :size="18" /></span>
        <div><small>现场作业中</small><strong>{{ stateCounts.ongoing }}<em>项</em></strong></div>
        <span class="operations-kpi__note">作业票生效</span>
      </article>
      <article class="operations-kpi operations-kpi--pending">
        <span class="operations-kpi__icon"><PsIcon name="Clock3" :size="18" /></span>
        <div><small>待开工 / 待确认</small><strong>{{ stateCounts.pending }}<em>项</em></strong></div>
        <span class="operations-kpi__note">开工前检查</span>
      </article>
      <article class="operations-kpi operations-kpi--paused">
        <span class="operations-kpi__icon"><PsIcon name="AlertTriangle" :size="18" /></span>
        <div><small>暂停作业</small><strong>{{ stateCounts.paused }}<em>项</em></strong></div>
        <span class="operations-kpi__note">待复核后恢复</span>
      </article>
      <button class="operations-kpi__risk" type="button" @click="emit('navigate', 'risk')">
        <span><PsIcon name="MapPin" :size="15" /> 作业关联风险单元</span>
        <strong>{{ ongoingUnitCount }}<small> 个动态升风险</small></strong>
        <PsIcon name="ChevronRight" :size="14" />
      </button>
    </section>

    <section class="operations-content">
      <div class="operations-main-column">
        <section class="ps-panel operations-register">
          <header class="operations-panel-head">
            <div>
              <span class="operations-eyebrow">WORK PERMIT · DAILY REGISTER</span>
              <h2><i class="ps-section-mark" />危险作业动态 <small>按作业票状态汇总</small></h2>
            </div>
            <label class="operations-search">
              <PsIcon name="Search" :size="14" />
              <input v-model="search" type="search" placeholder="搜索作业、单元、类型" aria-label="搜索危险作业" />
            </label>
          </header>

          <nav class="operations-filters" aria-label="按作业状态筛选">
            <button v-for="state in stateOrder" :key="state" type="button" :class="{ active: activeFilter === state }" @click="activeFilter = state">
              {{ stateLabels[state] }}
              <b>{{ state === 'all' ? park.operations.length : stateCounts[state] }}</b>
            </button>
          </nav>

          <div class="operations-table-wrap">
            <table class="operations-table">
              <thead><tr><th>作业项目 / 单元</th><th>类型</th><th>作业级别</th><th>单元风险</th><th>计划时段</th><th>现场状态</th><th>过程监护</th></tr></thead>
              <tbody>
                <tr v-for="op in filteredOperations" :key="op.id" :class="{ 'is-running': op.actualState === 'ongoing' }" @click="openUnit(op)">
                  <td>
                    <div class="operations-name"><span class="operations-row-id">{{ op.id }}</span><strong>{{ op.name }}</strong></div>
                    <small class="operations-unit">{{ unitName(op) }} <PsIcon name="ArrowUpRight" :size="10" /></small>
                  </td>
                  <td><span class="operations-type">{{ op.type }}</span></td>
                  <td><span class="operations-class" :data-state="operationRiskClass(op).state">{{ operationRiskClass(op).label }}</span></td>
                  <td><span class="operations-risk" :style="{ '--risk': RISK_LEVEL_COLOR[unitLevel(op)] }"><i />{{ RISK_LEVEL_LABEL[unitLevel(op)] }}</span></td>
                  <td><time class="operations-time">{{ timeRange(op) }}</time></td>
                  <td><span class="operations-state" :data-state="op.actualState"><i />{{ OPERATION_STATE_LABEL[op.actualState] }}</span></td>
                  <td><span class="operations-watch"><PsIcon name="ShieldCheck" :size="12" />{{ op.actualState === 'ongoing' ? '在岗监护' : op.actualState === 'pending' ? '开工前确认' : op.actualState === 'paused' ? '暂停巡查' : '已销案' }}</span></td>
                </tr>
                <tr v-if="!filteredOperations.length"><td colspan="6" class="operations-empty">没有匹配的作业记录</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="ps-panel operations-video-panel">
          <header class="operations-panel-head operations-panel-head--compact">
            <div><span class="operations-eyebrow">SELECTED SCENES · VIDEO CONNECTION</span><h2><i class="ps-section-mark" />典型作业现场 <small>预留 1–2 路接入</small></h2></div>
            <span class="operations-demo-tag"><i />视频接口待接入</span>
          </header>
          <div class="operations-video-grid">
            <article v-for="(op, index) in ongoing.slice(0, 2)" :key="op.id" class="operations-video-card" @click="openUnit(op)">
              <div class="operations-video-still" :class="`scene-${index + 1}`">
                <span class="operations-video-corner operations-video-corner--tl" />
                <span class="operations-video-corner operations-video-corner--tr" />
                <span class="operations-video-corner operations-video-corner--bl" />
                <span class="operations-video-corner operations-video-corner--br" />
                <span class="operations-video-offline"><PsIcon name="WifiOff" :size="15" />演示画面 · 等待现场视频</span>
                <small>CAM-0{{ index + 1 }}　{{ park.demoTime ? new Date(park.demoTime).toLocaleTimeString('zh-CN', { hour12: false }) : '--:--:--' }}</small>
                <b>示意画面</b>
              </div>
              <div class="operations-video-caption"><div><strong>{{ unitName(op) }}</strong><span>{{ op.name }}</span></div><em><i />作业中</em></div>
            </article>
            <div v-if="!ongoing.length" class="operations-video-empty">暂无现场作业视频</div>
          </div>
        </section>
      </div>

      <aside class="operations-side-column">
        <section class="ps-panel operations-audit">
          <header class="operations-panel-head operations-panel-head--compact">
            <div><span class="operations-eyebrow">AI PRE-CHECK · MOCK OUTPUT</span><h2><i class="ps-section-mark" />作业票 AI 预审</h2></div>
            <span class="operations-ai-mark"><PsIcon name="Cpu" :size="14" />演示</span>
          </header>
          <div class="operations-audit__result">
            <span class="operations-audit__verdict"><PsIcon name="AlertTriangle" :size="16" />建议补充后再提交</span>
            <small>动火票预审样例　·　OP003 提取车间 A 区</small>
          </div>
          <div class="operations-audit__score"><span>规则核对项</span><strong>2 <small>项需确认</small></strong><div><i style="width: 50%" /></div></div>
          <ul class="operations-audit__checks">
            <li v-for="step in auditSteps" :key="step.label" :data-state="step.state">
              <span><PsIcon :name="step.state === 'pass' ? 'CircleCheck' : step.state === 'attention' ? 'AlertTriangle' : 'Clock3'" :size="13" /></span>
              <div><b>{{ step.label }}</b><small>{{ step.detail }}</small></div>
            </li>
          </ul>
          <footer class="operations-audit__source">
            <PsIcon name="ClipboardList" :size="12" />
            依据：QG/ZY-ZA-033-2025《动火作业管理规定》5.3、5.4
          </footer>
        </section>

        <section class="ps-panel operations-qualification">
          <header class="operations-panel-head operations-panel-head--compact">
            <div><span class="operations-eyebrow">PERSONNEL & PERMIT</span><h2><i class="ps-section-mark" />人员资质核验</h2></div>
            <span class="operations-qualification__count"><b>06</b> 人员</span>
          </header>
          <div class="operations-qualification__summary">
            <span><i class="ok" />4 项已核验</span><span><i class="review" />2 项待现场复核</span>
          </div>
          <ul class="operations-qualification__list">
            <li><span class="operations-person-avatar">作</span><div><b>动火作业人员（2人）</b><small>特种作业资格 · 2/2 已核验</small></div><em class="ok"><PsIcon name="CircleCheck" :size="12" />已核验</em></li>
            <li><span class="operations-person-avatar">监</span><div><b>现场监护人（2人）</b><small>监护培训记录 · 1/2 已核验</small></div><em class="review"><PsIcon name="Clock3" :size="12" />待补 1 项</em></li>
            <li><span class="operations-person-avatar">责</span><div><b>作业责任人（1人）</b><small>责任信息 · 1/1 已登记</small></div><em class="ok"><PsIcon name="CircleCheck" :size="12" />已核验</em></li>
            <li><span class="operations-person-avatar">确</span><div><b>现场确认人（1人）</b><small>确认资格 · 待现场确认</small></div><em class="review"><PsIcon name="Clock3" :size="12" />待确认</em></li>
          </ul>
          <p class="operations-qualification__note">人员信息与资质状态为模拟数据，实际有效性以现场核验为准。</p>
        </section>

        <section class="operations-rule-note">
          <span><PsIcon name="Zap" :size="14" />风险联动规则</span>
          <p>固定动火区外的动火作业票生效并开始作业后，关联单元按规则升一级；作业结束并确认安全后恢复。</p>
          <small>动态识别规则表 · 演示口径</small>
        </section>
      </aside>
    </section>

    <UnitDetailDrawer />
  </div>
</template>

<style scoped>
.operations-dashboard { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 9px; flex: 1; min-height: 0; overflow: hidden; }
.operations-kpis { display: grid; grid-template-columns: repeat(4, minmax(130px, 1fr)) minmax(190px, 1.32fr); gap: 8px; flex-shrink: 0; }
.operations-kpi, .operations-kpi__risk { position: relative; display: flex; align-items: center; gap: 10px; min-height: 70px; padding: 9px 12px; overflow: hidden; border: 1px solid #203d50; border-radius: 5px; background: linear-gradient(120deg, #10283a, #0c1e2d); }
.operations-kpi::after { position: absolute; right: -18px; bottom: -32px; width: 84px; height: 84px; border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent); border-radius: 50%; box-shadow: 0 0 0 12px color-mix(in srgb, var(--accent) 4%, transparent), 0 0 0 24px color-mix(in srgb, var(--accent) 3%, transparent); content: ''; }
.operations-kpi--total { --accent: #3ca8c4; }.operations-kpi--active { --accent: #f1a63e; }.operations-kpi--pending { --accent: #69a9fa; }.operations-kpi--paused { --accent: #e6c44f; }
.operations-kpi__icon { display: grid; width: 34px; height: 34px; place-items: center; flex: 0 0 34px; border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); border-radius: 6px; color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); }
.operations-kpi small { display: block; color: #7c9daf; font-size: 10px; white-space: nowrap; }.operations-kpi strong { display: block; margin-top: 2px; color: #e2f2f8; font: 24px/1 'Bahnschrift', 'Consolas', monospace; }.operations-kpi strong em { margin-left: 3px; color: #7b9caf; font: 10px 'Microsoft YaHei', sans-serif; font-style: normal; }
.operations-kpi__note { align-self: flex-end; margin: 0 0 1px auto; color: #55778b; font-size: 9px; white-space: nowrap; }
.operations-kpi__risk { display: grid; grid-template-columns: 1fr auto; row-gap: 3px; border-color: #31586a; color: #98b8c8; text-align: left; cursor: pointer; }.operations-kpi__risk > span { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; }.operations-kpi__risk > strong { grid-column: 1; color: #f3ad50; font: 21px 'Bahnschrift', 'Consolas', monospace; }.operations-kpi__risk > strong small { display: inline; color: #839fae; font: 10px 'Microsoft YaHei', sans-serif; }.operations-kpi__risk > svg:last-child { grid-column: 2; grid-row: 1 / 3; color: #63869a; }
.operations-content { display: grid; grid-template-columns: minmax(0, 1.72fr) minmax(290px, .9fr); gap: 9px; min-height: 0; overflow: hidden; }.operations-main-column, .operations-side-column { display: flex; flex-direction: column; gap: 9px; min-width: 0; min-height: 0; }.operations-register, .operations-video-panel, .operations-audit, .operations-qualification { display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden; }.operations-register { flex: 1.1; }.operations-video-panel { flex: .9; }.operations-side-column > .operations-audit, .operations-side-column > .operations-qualification { flex: 1; }
.operations-panel-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 52px; padding: 8px 13px 5px; border-bottom: 1px solid #1c384a; flex-shrink: 0; }.operations-panel-head h2 { display: flex; align-items: center; gap: 7px; margin: 3px 0 0; color: #d7eaf2; font-size: 13px; font-weight: 500; }.operations-panel-head h2 small { color: #68899d; font-size: 9px; font-weight: 400; }.operations-panel-head--compact { min-height: 46px; padding-top: 7px; }.operations-eyebrow { color: #568096; font: 8px 'Bahnschrift', 'Consolas', monospace; letter-spacing: 1.1px; }.operations-search { display: flex; align-items: center; gap: 5px; width: min(230px, 42%); height: 28px; padding: 0 8px; border: 1px solid #244457; border-radius: 4px; color: #62869b; background: #091b29; }.operations-search input { width: 100%; border: 0; outline: 0; color: #c7e0ea; background: transparent; font-size: 10px; }.operations-search input::placeholder { color: #59798c; }
.operations-filters { display: flex; gap: 4px; padding: 7px 12px; flex-shrink: 0; }.operations-filters button { display: inline-flex; align-items: center; gap: 6px; padding: 5px 8px; border: 1px solid transparent; border-radius: 4px; color: #819eaf; background: transparent; font-size: 10px; cursor: pointer; }.operations-filters button b { color: #63869a; font: 10px 'Consolas', monospace; }.operations-filters button.active { border-color: #2a637a; color: #b8eaf2; background: #103247; }.operations-filters button.active b { color: #62cde0; }
.operations-table-wrap { flex: 1; min-height: 0; overflow: auto; padding: 0 10px 8px; }.operations-table { width: 100%; border-collapse: collapse; text-align: left; }.operations-table th { position: sticky; top: 0; z-index: 1; padding: 7px 5px; color: #5f8195; background: #0d2232; font-size: 9px; font-weight: 400; white-space: nowrap; }.operations-table td { padding: 8px 5px; border-bottom: 1px solid #1a3445; color: #a8c1ce; font-size: 10px; white-space: nowrap; }.operations-table tbody tr { cursor: pointer; transition: background .16s ease; }.operations-table tbody tr:hover { background: #112b3c; }.operations-table tbody tr.is-running td:first-child { border-left: 2px solid #ecaa44; }.operations-name { display: flex; align-items: center; gap: 6px; }.operations-name strong { overflow: hidden; max-width: 190px; color: #d1e5ed; font-size: 10px; font-weight: 500; text-overflow: ellipsis; }.operations-row-id { color: #548095; font: 9px 'Consolas', monospace; }.operations-unit { display: flex; align-items: center; gap: 2px; margin: 3px 0 0 31px; color: #65889c; font-size: 9px; }.operations-type { border: 1px solid #2a4b5d; border-radius: 3px; padding: 3px 5px; color: #a7c4d2; background: #102839; }.operations-class { color: #9db8c6; font-size: 9px; }.operations-class[data-state='high'] { color: #f08277; }.operations-class[data-state='condition'] { color: #e6b25d; }.operations-class[data-state='confirm'] { color: #6e91a6; }.operations-risk { display: inline-flex; align-items: center; gap: 5px; color: var(--risk); }.operations-risk i, .operations-state i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }.operations-time { color: #9ab7c5; font: 10px 'Consolas', monospace; }.operations-state { display: inline-flex; align-items: center; gap: 5px; }.operations-state[data-state='ongoing'] { color: #f3ad50; }.operations-state[data-state='pending'] { color: #70adf1; }.operations-state[data-state='paused'] { color: #e7c650; }.operations-state[data-state='completed'] { color: #55d0a4; }.operations-watch { display: inline-flex; align-items: center; gap: 4px; color: #81a1b2; }.operations-empty { padding: 25px !important; color: #65869a !important; text-align: center; }
.operations-demo-tag { display: inline-flex; align-items: center; gap: 5px; color: #6d8c9e; font-size: 9px; }.operations-demo-tag i { width: 6px; height: 6px; border-radius: 50%; background: #59768a; }.operations-video-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; flex: 1; min-height: 0; padding: 8px 11px 10px; }.operations-video-card { display: flex; flex-direction: column; min-width: 0; overflow: hidden; border: 1px solid #203e51; border-radius: 4px; background: #091b29; cursor: pointer; }.operations-video-still { position: relative; display: grid; flex: 1; min-height: 75px; place-items: center; overflow: hidden; background: radial-gradient(ellipse at 52% 55%, #27506888 0, transparent 43%), linear-gradient(155deg, #112d3e, #081622); }.operations-video-still::before { position: absolute; inset: 0; background: linear-gradient(0deg, #07131dc9, transparent 47%), repeating-linear-gradient(0deg, transparent 0 21px, #94d5e508 22px); content: ''; }.operations-video-still.scene-2 { background: radial-gradient(ellipse at 45% 60%, #4a442e99 0, transparent 42%), linear-gradient(155deg, #26353a, #081622); }.operations-video-still > small { position: absolute; top: 7px; left: 8px; color: #8baaba; font: 8px 'Consolas', monospace; }.operations-video-still > b { position: absolute; right: 8px; bottom: 7px; color: #7694a5; font-size: 8px; font-weight: 400; }.operations-video-corner { position: absolute; width: 10px; height: 10px; border-color: #5ecbe2; border-style: solid; opacity: .7; }.operations-video-corner--tl { top: 5px; left: 5px; border-width: 1px 0 0 1px; }.operations-video-corner--tr { top: 5px; right: 5px; border-width: 1px 1px 0 0; }.operations-video-corner--bl { bottom: 5px; left: 5px; border-width: 0 0 1px 1px; }.operations-video-corner--br { right: 5px; bottom: 5px; border-width: 0 1px 1px 0; }.operations-video-offline { position: relative; display: inline-flex; align-items: center; gap: 6px; color: #8fb0c1; font-size: 10px; }.operations-video-caption { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 8px; }.operations-video-caption div { min-width: 0; }.operations-video-caption strong, .operations-video-caption span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.operations-video-caption strong { color: #bfd6e1; font-size: 9px; font-weight: 500; }.operations-video-caption span { margin-top: 2px; color: #63849a; font-size: 8px; }.operations-video-caption em { display: flex; align-items: center; gap: 4px; color: #efad50; font-size: 8px; font-style: normal; white-space: nowrap; }.operations-video-caption em i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }.operations-video-empty { display: grid; grid-column: 1 / -1; place-items: center; color: #668699; font-size: 10px; }
.operations-ai-mark { display: inline-flex; align-items: center; gap: 4px; color: #80d7e2; font-size: 9px; }.operations-audit__result { display: flex; justify-content: space-between; align-items: center; gap: 6px; margin: 10px 12px 0; padding: 8px; border: 1px solid #815d2e66; border-radius: 4px; background: linear-gradient(100deg, #6c491c33, #35291633); }.operations-audit__verdict { display: inline-flex; align-items: center; gap: 6px; color: #f0b65e; font-size: 11px; }.operations-audit__result > small { color: #9e855e; font-size: 8px; }.operations-audit__score { position: relative; display: flex; align-items: baseline; gap: 8px; margin: 9px 13px 4px; color: #6e8da0; font-size: 9px; }.operations-audit__score strong { color: #e8b75f; font: 13px 'Consolas', monospace; }.operations-audit__score strong small { color: #9b8965; font: 9px 'Microsoft YaHei', sans-serif; }.operations-audit__score > div { position: absolute; right: 0; bottom: -5px; left: 0; height: 2px; background: #203b4c; }.operations-audit__score > div i { display: block; height: 100%; background: #e8ad4f; }.operations-audit__checks { display: flex; flex-direction: column; gap: 7px; margin: 9px 12px 8px; padding: 0; list-style: none; }.operations-audit__checks li { display: flex; align-items: flex-start; gap: 7px; }.operations-audit__checks li > span { display: grid; width: 20px; height: 20px; flex: 0 0 20px; place-items: center; border-radius: 50%; color: #60d0a6; background: #43b68b1c; }.operations-audit__checks li[data-state='attention'] > span { color: #f0b65e; background: #e7ab4b1c; }.operations-audit__checks li[data-state='pending'] > span { color: #79a9d9; background: #5797d21c; }.operations-audit__checks b, .operations-audit__checks small { display: block; }.operations-audit__checks b { color: #b7ccd7; font-size: 9px; font-weight: 500; }.operations-audit__checks small { margin-top: 2px; color: #6e8c9f; font-size: 8px; }.operations-audit__source { display: flex; align-items: center; gap: 5px; margin-top: auto; padding: 7px 11px; border-top: 1px solid #1d3748; color: #718da0; font-size: 8px; }
.operations-qualification__count { color: #68899c; font-size: 9px; }.operations-qualification__count b { color: #a9c7d5; font: 12px 'Consolas', monospace; }.operations-qualification__summary { display: flex; gap: 12px; padding: 8px 12px 4px; color: #819ca9; font-size: 9px; }.operations-qualification__summary span { display: inline-flex; align-items: center; gap: 5px; }.operations-qualification__summary i { width: 6px; height: 6px; border-radius: 50%; }.operations-qualification__summary i.ok { background: #4ac9a0; }.operations-qualification__summary i.review { background: #eab14f; }.operations-qualification__list { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 3px 12px; list-style: none; }.operations-qualification__list li { display: flex; align-items: center; gap: 8px; padding: 7px 0; border-top: 1px solid #1b3444; }.operations-person-avatar { display: grid; width: 26px; height: 26px; flex: 0 0 26px; place-items: center; border: 1px solid #2b5469; border-radius: 50%; color: #84c7d6; background: #164056; font-size: 10px; }.operations-qualification__list div { flex: 1; min-width: 0; }.operations-qualification__list b, .operations-qualification__list small { display: block; }.operations-qualification__list b { color: #c1d7e1; font-size: 9px; font-weight: 500; }.operations-qualification__list small { margin-top: 3px; overflow: hidden; color: #708da0; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }.operations-qualification__list em { display: flex; align-items: center; gap: 3px; font-size: 8px; font-style: normal; white-space: nowrap; }.operations-qualification__list em.ok { color: #59cba6; }.operations-qualification__list em.review { color: #e8b35b; }.operations-qualification__note { margin: auto 12px 9px; color: #617f92; font-size: 8px; line-height: 1.45; }.operations-rule-note { flex-shrink: 0; padding: 9px 12px; border: 1px solid #284b5f; border-radius: 5px; background: linear-gradient(110deg, #10293a, #0b1e2d); }.operations-rule-note > span { display: flex; align-items: center; gap: 5px; color: #77c9d8; font-size: 10px; }.operations-rule-note p { margin: 5px 0 3px; color: #9ab5c2; font-size: 9px; line-height: 1.45; }.operations-rule-note small { color: #597b8e; font-size: 8px; }

/* Improve readability on the presentation pages while preserving the dense dashboard layout. */
.operations-kpi small, .operations-kpi__risk > span { font-size: 12px; }
.operations-kpi__note, .operations-kpi strong em, .operations-kpi__risk > strong small { font-size: 11px; }
.operations-panel-head h2 { font-size: 15px; }
.operations-panel-head h2 small, .operations-search input, .operations-filters button { font-size: 12px; }
.operations-filters button b { font-size: 11px; }
.operations-eyebrow { font-size: 9px; }
.operations-table th { font-size: 11px; }
.operations-table td, .operations-name strong, .operations-type, .operations-risk, .operations-state, .operations-watch, .operations-time { font-size: 12px; }
.operations-row-id, .operations-unit, .operations-class { font-size: 10px; }
.operations-demo-tag, .operations-video-offline, .operations-video-empty, .operations-audit__score, .operations-qualification__summary { font-size: 11px; }
.operations-video-still > small, .operations-video-still > b, .operations-video-caption span, .operations-video-caption em, .operations-audit__result > small, .operations-audit__score strong small, .operations-audit__checks small, .operations-audit__source, .operations-qualification__list small, .operations-qualification__list em, .operations-qualification__note, .operations-rule-note small { font-size: 10px; }
.operations-video-caption strong, .operations-audit__checks b { font-size: 11px; }
.operations-rule-note p { font-size: 11px; }

@media (max-width: 1150px) { .operations-kpis { grid-template-columns: repeat(4, minmax(100px, 1fr)); }.operations-kpi__risk { display: none; }.operations-content { grid-template-columns: minmax(0, 1.5fr) minmax(260px, .9fr); }.operations-watch { font-size: 0; }.operations-watch :deep(svg) { font-size: initial; } }
@media (max-width: 850px) { .operations-content { grid-template-columns: minmax(0, 1fr); overflow: auto; }.operations-main-column { min-height: 520px; }.operations-side-column { min-height: 560px; }.operations-dashboard { overflow: auto; }.operations-kpi { min-height: 62px; padding: 7px; gap: 7px; }.operations-kpi__note { display: none; } }
</style>
