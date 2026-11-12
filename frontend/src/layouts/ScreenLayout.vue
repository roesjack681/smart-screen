<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PsIcon from '@/components/safety/PsIcon.vue';
import OverviewView from '@/views/OverviewView.vue';
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
const route = useRoute();
const router = useRouter();

/** 顶栏四项：总览 / 危险作业监控 / 生产安全预警 / 动态风险评估；仅总览为本团队真实页面 */
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
    maintenance: 'overview',
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

function go(target: string): void {
  if (target === 'overview') {
    void router.push({ path: '/dashboard' });
    return;
  }
  void router.push({ path: '/dashboard', query: { view: target } });
}

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
  <div class="ps-app">
    <header class="ps-topbar">
      <div class="ps-brand">
        <div class="ps-brand-emblem"><PsIcon name="ShieldCheck" :size="25" /></div>
        <div>
          <b>生产安全感知平台</b>
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
          <i v-if="item.key === 'production' && park.pendingAlarms.length" class="ps-nav-count">
            {{ park.pendingAlarms.length }}
          </i>
        </button>
      </nav>

      <div class="ps-header-right">
        <span class="ps-demo-label">演示</span>
        <span class="ps-header-clock">
          {{ formatClock(park.demoTime) }}
          <small>{{ formatDate(park.demoTime) }}</small>
        </span>
      </div>
    </header>

    <main class="ps-main">
      <div class="ps-page-header">
        <div>
          <div class="ps-eyebrow">
            <span />
            M5 香料工程中心 <i>/</i> {{ page.titleEn }}
          </div>
          <h1>
            {{ page.title }}
            <span class="ps-operating-status">
              <i />
              {{ park.pendingAlarms.length ? '预警跟踪中' : '全域运行平稳' }}
            </span>
          </h1>
        </div>
        <div v-if="page.owned" class="ps-page-actions">
          <button class="ps-button ps-button-small" type="button" @click="park.scenarioReset()">
            <PsIcon name="RefreshCw" :size="15" />
            重置场景
          </button>
          <button
            class="ps-icon-button ps-fullscreen-button"
            type="button"
            :aria-label="fullscreen ? '退出全屏' : '进入全屏'"
            @click="toggleFullscreen"
          >
            <PsIcon :name="fullscreen ? 'Minimize2' : 'Maximize2'" :size="19" />
          </button>
        </div>
      </div>

      <OverviewView v-if="page.owned" @navigate="go" />
      <section v-else class="ps-panel ps-placeholder" aria-hidden="true" />

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
.ps-placeholder {
  min-height: 420px;
  margin-top: 8px;
}
</style>
