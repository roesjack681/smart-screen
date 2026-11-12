import {
  ApartmentOutlined,
  BookOutlined,
  DashboardOutlined,
  FormOutlined,
  GiftOutlined,
  MenuOutlined,
  ProfileOutlined,
  SettingOutlined,
  ShoppingOutlined,
  TeamOutlined,
  ToolOutlined,
  UnorderedListOutlined,
  UserOutlined,
  WalletOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  CloudOutlined,
  ApiOutlined,
  BellOutlined,
  CalendarOutlined,
  FolderOutlined,
  HomeOutlined,
  MailOutlined,
  SafetyOutlined,
} from '@ant-design/icons-vue';
import type { Component } from 'vue';

const iconMap: Record<string, Component> = {
  DashboardOutlined,
  SettingOutlined,
  UserOutlined,
  TeamOutlined,
  MenuOutlined,
  BookOutlined,
  ApartmentOutlined,
  ToolOutlined,
  GiftOutlined,
  WalletOutlined,
  UnorderedListOutlined,
  FormOutlined,
  ShoppingOutlined,
  ProfileOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  CloudOutlined,
  ApiOutlined,
  BellOutlined,
  CalendarOutlined,
  FolderOutlined,
  HomeOutlined,
  MailOutlined,
  SafetyOutlined,
};

export const MENU_ICON_OPTIONS = Object.keys(iconMap).map((name) => ({
  value: name,
  label: name.replace(/Outlined$/, ''),
}));

export function resolveMenuIcon(name?: string | null): Component {
  if (!name) return MenuOutlined;
  return iconMap[name] ?? MenuOutlined;
}
