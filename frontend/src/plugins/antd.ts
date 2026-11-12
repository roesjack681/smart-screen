import type { App } from 'vue';
import Antd, { Modal } from 'ant-design-vue';
import type { ModalFuncProps } from 'ant-design-vue';
import 'ant-design-vue/dist/reset.css';

type ModalMethod = (props: ModalFuncProps) => ReturnType<typeof Modal.confirm>;

const ZH_BUTTONS: Pick<ModalFuncProps, 'okText' | 'cancelText'> = {
  okText: '确定',
  cancelText: '取消',
};

function wrapModalMethod(method: ModalMethod): ModalMethod {
  return (props) => method({ ...ZH_BUTTONS, ...props });
}

/** 静态 Modal 方法不吃 ConfigProvider 文案，这里统一中文按钮 */
function patchModalLocale(): void {
  const target = Modal as unknown as Record<string, ModalMethod>;
  for (const key of ['confirm', 'info', 'success', 'error', 'warning'] as const) {
    target[key] = wrapModalMethod(target[key].bind(Modal));
  }
}

export function setupAntd(app: App): void {
  patchModalLocale();
  app.use(Antd);
}
