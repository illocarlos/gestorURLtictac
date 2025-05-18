<script setup>
import { ref, onMounted, watch, onUnmounted  } from 'vue';
import UrlForm from './components/UrlForm.vue';
import UrlList from './components/UrlList.vue';
import LoginForm from './components/LoginForm.vue';
import ThemeCustomizerModal from './components/ThemeCustomizerModal.vue'; // Importar el nuevo componente
import { useUrlStore } from './stores/url';
import { useAuthStore } from './stores/auth';
import { useThemeStore } from './stores/theme'; // Importar el store de temas

const urlStore = useUrlStore();
const authStore = useAuthStore();
const themeStore = useThemeStore(); // Inicializar el store de temas
let unsubscribeDomainOrder = null;

// Estado para controlar la visualización del modal de temas
const showThemeModal = ref(false);

onMounted(() => {
  console.log("App.vue montado - Inicializando autenticación");
  unsubscribeDomainOrder = urlStore.listenToDomainOrderChanges();

  // Inicializar estado de autenticación
  authStore.init();
  
  // Inicializar temas cuando se monta la aplicación
  themeStore.init();
});

onUnmounted(() => {
    // Limpiar el listener cuando el componente se desmonta
    if (unsubscribeDomainOrder) unsubscribeDomainOrder();
});

// Observar cambios en el estado de autenticación para cargar datos
watch(() => authStore.isAuthenticated, (isAuthenticated) => {
  console.log("Estado de autenticación cambió:", isAuthenticated);
  if (isAuthenticated) {
    // Cargar datos solo cuando el usuario está autenticado
    console.log("Usuario autenticado, cargando URLs...");
    setTimeout(() => {
      urlStore.fetchUrls();
    }, 200); // Pequeño retraso para asegurar que todo está inicializado
  }
}, { immediate: true });

// Función para cerrar sesión
const handleLogout = async () => {
  await authStore.logout();
};

// Función para abrir el modal de personalización de temas
const openThemeModal = () => {
  showThemeModal.value = true;
};

// Función para cerrar el modal de personalización de temas
const closeThemeModal = () => {
  showThemeModal.value = false;
};

// Función para manejar la actualización del tema
const handleThemeUpdated = () => {
  console.log('Tema actualizado correctamente');
  // Podríamos añadir lógica adicional si es necesario
};
</script>

<template>
  <div class="min-h-screen bg-gray-100" :style="themeStore.cssVars">
    <template v-if="authStore.loading">
      <!-- Pantalla de carga mientras verificamos autenticación -->
      <div class="min-h-screen flex items-center justify-center">
        <div class="animate-pulse flex flex-col items-center">
          <div class="h-12 w-12 bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-primary)] to-[var(--color-secondary)] rounded-full"></div>
          <p class="mt-4 text-gray-500">Cargando...</p>
        </div>
      </div>
    </template>
    
    <template v-else-if="!authStore.isAuthenticated">
      <!-- Pantalla de login si no está autenticado -->
      <LoginForm />
    </template>
    
    <template v-else>
      <!-- Contenido principal cuando está autenticado -->
      <header class="bg-white shadow py-6 bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-primary)] to-[var(--color-secondary)]">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 class="text-3xl font-bold text-gray-800 text-center text-white">Gestor URL</h1>
          
          <!-- Información de usuario, botón de temas y botón de logout -->
          <div class="flex items-center space-x-4">
            <span class="text-white text-sm">{{ authStore.user?.email }}</span>
            
            <!-- Nuevo botón para personalizar temas -->
            <button @click="openThemeModal" 
                    class="py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 text-sm font-medium"
                    :style="{ backgroundColor: themeStore.accentColor, color: themeStore.textColor }">
              <span class="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clip-rule="evenodd" />
                </svg>
                Personalizar
              </span>
            </button>
            
            <button @click="handleLogout" 
                    class="py-2 px-4 bg-white text-[var(--color-primary)] rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] text-sm font-medium">
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <UrlForm />
        <UrlList />
      </main>

      <footer class="border-t border-gray-200 py-6 mt-12 bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-primary)] to-[var(--color-secondary)]">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p class="text-center text-white text-sm">
            © 2025 Gestor URL - Sistema de revisión de URL
            <span class="text-lg font-bold">
              TicTac Comunicación
            </span>
          </p>
        </div>
      </footer>
      
      <!-- Modal de personalización de temas -->
      <ThemeCustomizerModal 
        :is-open="showThemeModal" 
        @close="closeThemeModal"
        @theme-updated="handleThemeUpdated"
      />
    </template>
  </div>
</template>

<style>
/* Estilos globales para botones basados en variables CSS de temas */
button.button-custom {
  color: var(--color-text, black);
  background: var(--color-accent, #BBF33A);
  transition: 0.4s ease;
}

button.button-custom:hover {
  color: white;
}

/* Variables CSS predeterminadas (serán reemplazadas por el sistema de temas) */
:root {
  --color-primary: #EC4899;
  --color-secondary: #9333EA;
  --color-accent: #BBF33A;
  --color-background: #F3F4F6;
  --color-text: #111827;
}
</style>