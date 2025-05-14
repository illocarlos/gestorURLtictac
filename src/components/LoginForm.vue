<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const requestingAccess = ref(false);
const accessRequested = ref(false);
const loginInProgress = ref(false); // Nuevo estado para controlar múltiples clics

onMounted(() => {
  console.log("LoginForm montado - Inicializando autenticación");
  // Inicializar el store de autenticación
  authStore.init();
});

async function handleGoogleLogin() {
  if (loginInProgress.value) return; // Evitar múltiples clics
  
  console.log("Botón de login con Google presionado");
  loginInProgress.value = true;
  
  try {
    const success = await authStore.loginWithGoogle();
    console.log("Resultado de login:", success);
  } catch (error) {
    console.error("Error en handleGoogleLogin:", error);
  } finally {
    loginInProgress.value = false;
  }
}

async function handleRequestAccess() {
  requestingAccess.value = true;
  try {
    const success = await authStore.requestAccess();
    if (success) {
      accessRequested.value = true;
    }
  } finally {
    requestingAccess.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-100">
    <div class="max-w-md w-full p-6 bg-white rounded-lg shadow-lg">
      <div class="flex justify-center mb-4">
        <img src="/logo.png" alt="Gestor URL" class="h-20 w-auto" onerror="this.src='https://via.placeholder.com/80x80?text=URL'" />
      </div>
      
      <div class="text-center mb-8">
        <h1 class="text-2xl font-semibold bg-gradient-to-r from-pink-600 via-pink-700 to-purple-800 text-transparent bg-clip-text">
          Gestor URL
        </h1>
        <p class="text-gray-600 mt-1">Sistema de revisión de URL</p>
      </div>

      <!-- Error message -->
      <div v-if="authStore.error" class="mb-6 p-4 bg-red-100 text-red-700 rounded-md text-sm">
        {{ authStore.error }}
      </div>

      <!-- Mensaje de solicitud enviada -->
      <div v-if="accessRequested" class="mb-6 p-4 bg-green-100 text-green-700 rounded-md text-sm">
        Tu solicitud de acceso ha sido enviada. Serás notificado cuando sea aprobada.
      </div>

      <div class="space-y-6">
        <div class="text-center text-gray-600 text-sm mb-4">
          Inicia sesión para acceder al gestor URL
        </div>
        
        <button
          @click="handleGoogleLogin"
          type="button"
          :disabled="accessRequested || loginInProgress"
          class="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          :class="{ 'opacity-50 cursor-not-allowed': accessRequested || loginInProgress }"
        >
          <svg class="h-5 w-5 mr-2" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
            <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
              <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
              <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
              <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
              <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
            </g>
          </svg>
          <span v-if="loginInProgress">Iniciando sesión...</span>
          <span v-else>Iniciar sesión con Google</span>
        </button>
        
        <!-- Botón para solicitar acceso -->
        <div v-if="authStore.error && authStore.error.includes('No tienes autorización') && !accessRequested" class="mt-4">
          <button
            @click="handleRequestAccess"
            :disabled="requestingAccess"
            class="w-full text-sm py-2 px-4 bg-pink-600 text-white rounded-md hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
          >
            {{ requestingAccess ? 'Enviando solicitud...' : 'Solicitar acceso' }}
          </button>
        </div>
        
        <div class="text-center text-xs text-gray-500 mt-8">
          Solo usuarios autorizados pueden acceder a esta aplicación.
        </div>
      </div>
    </div>
  </div>
</template>