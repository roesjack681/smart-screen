<script setup>
import { Activity, Bell, BellRing, ShieldCheck, Thermometer, Wrench, ArrowUpRight, ArrowDownRight, ArrowLeft, ChevronRight, ChevronDown, Check, CheckCheck, CircleCheck, CircleAlert, Clock3, Download, Filter, Fullscreen, Gauge, Layers, LayoutDashboard, MapPin, Plus, Play, Pause, Radio, RefreshCw, Search, Settings2, SlidersHorizontal, Volume2, VolumeX, Wifi, WifiOff, X, Zap, TrendingUp, ClipboardList, Factory, Cpu, Maximize2, Minimize2 } from '@lucide/vue'
defineProps({ name: String, size: { type: Number, default: 18 } })
const icons = { Activity, Bell, BellRing, ShieldCheck, Thermometer, Wrench, ArrowUpRight, ArrowDownRight, ArrowLeft, ChevronRight, ChevronDown, Check, CheckCheck, CircleCheck, CircleAlert, Clock3, Download, Filter, Fullscreen, Gauge, Layers, LayoutDashboard, MapPin, Plus, Play, Pause, Radio, RefreshCw, Search, Settings2, SlidersHorizontal, Volume2, VolumeX, Wifi, WifiOff, X, Zap, TrendingUp, ClipboardList, Factory, Cpu, Maximize2, Minimize2 }
</script>
<template><component :is="icons[name] || icons.Activity" :size="size" :stroke-width="1.7" aria-hidden="true" /></template>
