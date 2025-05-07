
import { createApp } from 'vue'
import { VueFire, VueFireAuth } from 'vuefire'
import App from './App.vue'
import './style.css'
import { firebaseApp } from './config/firebase'
import { createPinia } from 'pinia'

const app = createApp(App)
const pinia = createPinia()

// Usar Pinia
app.use(pinia)

// Usar VueFire
app.use(VueFire, {
    firebaseApp,
    modules: [
        VueFireAuth(), // Si necesitas autenticación
    ],
})

app.mount('#app')