<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PsIcon from '@/components/safety/PsIcon.vue';
import OverviewView from '@/views/OverviewView.vue';
import OperationsView from '@/views/OperationsView.vue';
import SafetyPanel from '@/components/safety/SafetyPanel.vue';
import SafetyControls from '@/components/safety/SafetyControls.vue';
import { useSafetyBridge } from '@/composables/useSafetyBridge';
import { useParkStore } from '@/stores/park';

type PageKey = 'overview' | 'operations' | 'production' | 'risk';

interface PageItem {
  key: PageKey;
  label: string;
  icon: string;
  title: string;
  titleEn: string;
  owned: boolean;
}

const park = useParkStore();
const safety = useSafetyBridge();
const route = useRoute();
const router = useRouter();

/** 保留总览和其他模块，仅接入生产安全预警。 */
const pages: PageItem[] = [
  {
    key: 'overview',
    label: '总览',
    icon: 'LayoutDashboard',
    title: '园区安全运行总览',
    titleEn: 'PARK SAFETY OVERVIEW',
    owned: true,
  },
  {
    key: 'operations',
    label: '危险作业监控',
    icon: 'Activity',
    title: '危险作业监控',
    titleEn: 'HAZARDOUS WORK MONITORING',
    owned: false,
  },
  {
    key: 'production',
    label: '生产安全预警',
    icon: 'Bell',
    title: '生产安全预警',
    titleEn: 'PRODUCTION SAFETY WARNING',
    owned: false,
  },
  {
    key: 'risk',
    label: '动态风险评估',
    icon: 'ShieldCheck',
    title: '动态风险评估',
    titleEn: 'DYNAMIC RISK ASSESSMENT',
    owned: false,
  },
];

const view = computed<PageKey>(() => {
  const key = String(route.query.view || 'overview') as PageKey;
  // 兼容旧 query
  const alias: Record<string, PageKey> = {
    monitor: 'operations',
    warning: 'production',
  };
  const mapped = alias[key] || key;
  return pages.some((p) => p.key === mapped) ? mapped : 'overview';
});
const page = computed(() => pages.find((p) => p.key === view.value) || pages[0]);

const fullscreen = ref(false);
let clockTimer: number | undefined;

function formatClock(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function go(target: string, extra: Record<string, string> = {}): void {
  if (target === 'overview') {
    void router.push({ path: '/dashboard' });
    return;
  }
  void router.push({ path: '/dashboard', query: { view: target, ...extra } });
}

const placeholderFilters = computed(() => {
  const q = route.query;
  const rows: Array<{ k: string; v: string }> = [];
  if (q.level) rows.push({ k: '风险等级筛选', v: String(q.level) });
  if (q.state) rows.push({ k: '作业状态筛选', v: String(q.state) });
  if (q.topic) rows.push({ k: '生产安全专题', v: String(q.topic) });
  if (q.unitId) rows.push({ k: '关联风险单元', v: String(q.unitId) });
  if (q.focus) rows.push({ k: '焦点', v: String(q.focus) });
  return rows;
});

async function toggleFullscreen(): Promise<void> {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch {
    // 容器可能不允许全屏
  }
}

function onFullscreen(): void {
  fullscreen.value = !!document.fullscreenElement;
}

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullscreen);
  clockTimer = window.setInterval(() => park.tickDemoClock(), 1000);
});

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFullscreen);
  if (clockTimer) window.clearInterval(clockTimer);
});
</script>

<template>
  <div class="ps-app" :class="{ 'ps-homepage': page.owned }">
    <header class="ps-topbar">
      <div class="ps-brand">
        <div class="ps-brand-emblem"><PsIcon name="ShieldCheck" :size="25" /></div>
        <div class="ps-brand-text">
          <div class="ps-brand-title-row">
            <b>生产安全感知平台</b>
            <span class="ps-operating-status" :data-alert="park.pendingAlarms.length ? '1' : '0'">
              <i />
              {{ (view === 'production' ? safety.activeAlarms.value.length : park.pendingAlarms.length) ? '预警跟踪中' : '全域运行平稳' }}
            </span>
          </div>
          <span>SAFETY OPERATIONS CENTER</span>
        </div>
      </div>

      <nav aria-label="平台页面">
        <button
          v-for="item in pages"
          :key="item.key"
          type="button"
          :class="{ active: view === item.key }"
          :aria-current="view === item.key ? 'page' : undefined"
          @click="go(item.key)"
        >
          <PsIcon :name="item.icon" :size="16" />
          <span>{{ item.label }}</span>
          <i v-if="item.key === 'production' && safety.pendingAlarms.value.length" class="ps-nav-count">
            {{ safety.pendingAlarms.value.length }}
          </i>
        </button>
      </nav>

      <div class="ps-header-right">
        <SafetyControls />
        <span class="ps-demo-label">演示</span>
        <span class="ps-header-clock">
          {{ formatClock(park.demoTime) }}
          <small>{{ formatDate(park.demoTime) }}</small>
        </span>
        <button
          class="ps-icon-button ps-fullscreen-button"
          type="button"
          :aria-label="fullscreen ? '退出全屏' : '进入全屏'"
          @click="toggleFullscreen"
        >
          <PsIcon :name="fullscreen ? 'Minimize2' : 'Maximize2'" :size="19" />
        </button>
      </div>
    </header>

    <main class="ps-main">
      <div class="ps-main-body">
        <OverviewView v-if="view === 'overview'" @navigate="go" />
        <OperationsView v-else-if="view === 'operations'" @navigate="go" />
        <SafetyPanel v-else-if="view === 'production'" :store="safety" />
        <section v-else class="ps-panel park-placeholder" :aria-label="page.title">
          <div class="park-placeholder__body">
            <h2>{{ page.title }}</h2>
            <p>总览、危险作业、生产安全预警已接入。其余子页尚未展开，以下为总览带入的筛选 / 上下文占位。</p>
            <ul v-if="placeholderFilters.length">
              <li v-for="row in placeholderFilters" :key="row.k">
                <em>{{ row.k }}</em>
                <b>{{ row.v }}</b>
              </li>
            </ul>
            <p v-else class="park-placeholder__empty">未带筛选条件，可从总览指标 / 列表点击进入以验证跳转。</p>
            <button class="ps-button ps-button-primary" type="button" @click="go('overview')">返回总览</button>
          </div>
        </section>
      </div>

      <footer class="ps-footer">
        <span>
          <i class="ps-dot" />
          演示数据
          <i class="ps-footer-separator" />
          示意布局
        </span>
        <span>园区风险单元 · 四色动态</span>
        <span>
          演示时钟 {{ formatClock(park.demoTime) }}
          <span class="ps-footer-indicator" />
        </span>
      </footer>
    </main>
  </div>
</template>

<style scoped>
.ps-app {
  height: 100vh;
  height: 100dvh;
  max-height: 100vh;
  max-height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.ps-topbar {
  flex-shrink: 0;
}

.ps-main {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-width: none;
  margin: 0;
  padding: 0 12px;
  box-sizing: border-box;
}

.ps-brand {
  min-width: 320px;
}

.ps-brand-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ps-brand-title-row .ps-operating-status {
  flex-shrink: 0;
  transform: translateY(1px);
}

.ps-brand-title-row .ps-operating-status[data-alert='1'] {
  color: #f59a38;
  border-color: #9372415c;
  background: #75552713;
}

.ps-brand-title-row .ps-operating-status[data-alert='1'] i {
  background: #f59a38;
}

.ps-main-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding-top: 8px;
}

.ps-footer {
  flex-shrink: 0;
  min-height: 28px;
}

.ps-fullscreen-button {
  margin-left: 2px;
}

.park-placeholder {
  flex: 1;
  min-height: 0;
  margin-top: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.park-placeholder__body {
  max-width: 560px;
  padding: 28px 32px;
  text-align: left;
}

.park-placeholder__body h2 {
  font-size: 22px;
  color: #eaf3fa;
  margin-bottom: 10px;
}

.park-placeholder__body > p {
  font-size: 13px;
  color: #9bb6cb;
  line-height: 1.6;
  margin-bottom: 16px;
}

.park-placeholder__body ul {
  list-style: none;
  margin: 0 0 18px;
  padding: 0;
  display: grid;
  gap: 8px;
}

.park-placeholder__body li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #2a4358;
  border-radius: 4px;
  background: #0d2436;
}

.park-placeholder__body em {
  font-style: normal;
  color: #7f9eb1;
  font-size: 12px;
}

.park-placeholder__body b {
  color: #d7ebf6;
  font-size: 13px;
}

.park-placeholder__empty {
  margin-bottom: 18px !important;
}
</style>
