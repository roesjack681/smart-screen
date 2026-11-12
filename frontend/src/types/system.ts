export interface SystemConfig {
  platformName: string;
}

export interface RouteMenuItem {
  id: number;
  parentId: number | null;
  name: string;
  path: string | null;
  icon: string | null;
  permission: string | null;
  children?: RouteMenuItem[];
}
