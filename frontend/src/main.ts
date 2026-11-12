import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { BRAND } from './config/brand';
import './styles/demo.css';
import './styles/safety.css';
import './styles/park-overview.scss';

document.title = BRAND.name;

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
