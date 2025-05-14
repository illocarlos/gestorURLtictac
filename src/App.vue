<script setup>
import { ref, onMounted, watch } from 'vue';
import UrlForm from './components/UrlForm.vue';
import UrlList from './components/UrlList.vue';
import LoginForm from './components/LoginForm.vue';
import { useUrlStore } from './stores/url';
import { useAuthStore } from './stores/auth';

const urlStore = useUrlStore();
const authStore = useAuthStore();

onMounted(() => {
  console.log("App.vue montado - Inicializando autenticación");
  // Inicializar estado de autenticación
  authStore.init();
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
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <template v-if="authStore.loading">
      <!-- Pantalla de carga mientras verificamos autenticación -->
      <div class="min-h-screen flex items-center justify-center">
        <div class="animate-pulse flex flex-col items-center">
          <div class="h-12 w-12 bg-gradient-to-r from-pink-600 via-pink-700 to-purple-800 rounded-full"></div>
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
      <header class="bg-white shadow py-6 bg-gradient-to-r from-pink-600 via-pink-700 to-purple-800">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 class="text-3xl font-bold text-gray-800 text-center text-white">Gestor URL</h1>
          
          <!-- Información de usuario y botón de logout -->
          <div class="flex items-center space-x-4">
            <span class="text-white text-sm">{{ authStore.user?.email }}</span>
            <button @click="handleLogout" 
                    class="py-2 px-4 bg-white text-pink-700 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 text-sm font-medium">
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <UrlForm />
        <UrlList />
      </main>

      <footer class="border-t border-gray-200 py-6 mt-12 bg-gradient-to-r from-pink-600 via-pink-700 to-purple-800">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p class="text-center text-white text-sm">
            © 2025 Gestor URL - Sistema de revisión de URL
            <span class="text-lg font-bold">
              TicTac Comunicación
            </span>
          </p>
        </div>
      </footer>
    </template>
  </div>
</template>

<style>
button {
  color: black;
  background: #BBF33A;
}
</style>