<script setup lang="ts">
import BaseDialog from './BaseDialog.vue';
defineEmits<{ close: [] }>();
const rules = [
  ['库房 / 垛位 / 片烟批次','包心≥32℃每两天、≥35℃每日检查；均温高于环境2℃每日检查','原料贮存程序 §5.3.4.2'],
  ['包心均温温差异常','超过环境4℃按不合格品程序处理，环境异常变温、高温天气入库除外','原料贮存程序 §5.3.4.2'],
  ['仓间温湿度 / 备料库存放','每天14—16时登记环境温湿度；备料库连续存放不超过1个月','原料贮存程序 §5.3.2 / §5.2.4'],
  ['提取温度 / 压力 / 液位', '高报关注，高高报或多参数并发重点处置', '规则8 / 9 / 10'],
  ['地埋乙醇储罐液位', '核对液位、停止相关收发料、防溢流', '规则11'],
  ['可燃气体探测', '高报通风并查源；高高报切断、疏散、应急', '规则4 / 5'],
  ['香精 / 酒精大面积泄漏', '红色提示，切断来源、警戒隔离与疏散', '规则6 / 7'],
  ['地埋罐泄漏检测', '红色提示，停泵隔离、检测复核、应急处置', '规则12'],
];
</script>
<template>
  <BaseDialog title="预警判定依据" subtitle="原料仓储与生产工艺分别建模" wide @close="$emit('close')">
    <p class="basis-intro">来源：《M5-香料工程中心车间风险等级动态识别规则与判定口径.xlsx》“动态识别规则与判定口径”“风险等级与判定说明”两张表。</p>
    <div class="basis-rules"><article v-for="rule in rules" :key="rule[0]"><b>{{ rule[0] }}</b><p>{{ rule[1] }}</p><small>{{ rule[2] }}</small></article></div>
    <div class="basis-flow"><span>① 发现异常</span><i>→</i><span>② 全局提醒</span><i>→</i><span>③ 确认并处置</span><i>→</i><span>④ 信号恢复</span><i>→</i><span>⑤ 红色人工复核</span></div>
    <ul class="basis-notes">
      <li>仓储依据《原料贮存、养护和发放控制程序》。库名、垛位布局、批次、环境数据均为Mock；热力图数值表示该垛抽检包心均温的模拟实时序列。资料要求的实际采样方式为人工抽检，图中实时刷新不代表现场已有传感器。</li>
      <li>32℃、35℃为温检频次条件，采用黄色待办提示；温差超过4℃且非例外情形采用红色复核优先级，颜色是Demo设计。环境湿度未配置报警阈值，附件引用的技术要求未提供，不自行编造合格范围。</li>
      <li>文档给出高报、高高报信号和升级原则，未给出工艺数值。当前温度、压力、液位、%LEL、持续时间和斜率数值均为演示配置。低限、变化速率、通信中断为补充演示规则。</li>
      <li>同一装置温度、压力、液位中至少两类参数同时超限，演示为红色并发事件。同一参数的多条规则不重复计数，不叠加计算区域风险等级。</li>
      <li>黄色、红色在本页表示告警提示级别。资料中的蓝黄橙红表示区域风险等级；本页不计算或改写区域风险评估。</li>
      <li>红色事件：确认仅表示已收到；信号恢复、现场确认无异常并记录复核结果后解除。视频AI输出需要人工核验。</li>
      <li>原表气体信号写作“二级报警（高报）”“一级报警（高高报/预警）”。页面按高报、高高报展示；实际接入前需核对探测器信号映射。</li>
      <li>上述切断、通风、停泵等为处置建议。本地演示未执行设备控制。</li>
    </ul>
    <div class="ps-dialog-actions"><button class="ps-button ps-button-primary" @click="$emit('close')">了解</button></div>
  </BaseDialog>
</template>
<style scoped>
.basis-intro { font-size:11px; color:#81a6ba; line-height:1.9; }
.basis-rules { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin:16px 0; }
.basis-rules article { position:relative; border:1px solid #2c4b61; background:#0d273a; padding:12px; border-radius:4px; }
.basis-rules b { font-size:12px; font-weight:500; color:#c2dce7; }
.basis-rules p { font-size:11px; color:#88a9bb; line-height:1.8; margin:6px 0; }
.basis-rules small { font-size:10px; color:#43b4c9; }
.basis-flow { display:flex; flex-wrap:wrap; align-items:center; gap:7px; color:#84b9cb; font-size:11px; padding:13px 0; border-top:1px solid #244357; border-bottom:1px solid #244357; }
.basis-flow i { color:#3a768b; font-style:normal; }
.basis-notes { padding-left:17px; margin:12px 0 0; color:#789db2; font-size:11px; line-height:1.9; }
.basis-notes li + li { margin-top:6px; }
@media(max-width:560px) { .basis-rules { grid-template-columns:1fr; } }
</style>
