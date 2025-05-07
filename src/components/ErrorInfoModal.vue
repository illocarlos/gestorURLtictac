<script setup>
import { ref } from 'vue';
import useImages from '../composables/useImages';

defineProps({
  isOpen: Boolean,
  url: Object
});

const emit = defineEmits(['close']);

// Inicializar el composable
const { getImageDisplayUrl } = useImages('error-images');

// Estado para controlar la imagen ampliada
const zoomedImageSrc = ref(null);
const isZooming = ref(false);

// Función para obtener la URL de la imagen
const getDisplayUrl = (imageUrl, fallbackUrl) => {
  return imageUrl || fallbackUrl;
};

// Función para abrir la imagen en vista ampliada
const openZoom = (imageUrl, fallbackUrl) => {
  zoomedImageSrc.value = getDisplayUrl(imageUrl, fallbackUrl);
  isZooming.value = true;
};

// Función para cerrar la vista ampliada
const closeZoom = () => {
  isZooming.value = false;
  zoomedImageSrc.value = null;
};
</script>

<template>
  <div v-if="isOpen && url"
    class="fixed inset-0 bg-black bg-opacity-60 overflow-y-auto h-full w-full flex items-center justify-center z-50">
    <div
      class="relative mx-auto p-5  w-full max-w-xl shadow-lg rounded-md bg-gradient-to-r from-pink-600 via-pink-700 to-purple-800">
      <!-- Botón X para cerrar (arriba a la derecha) -->
      <button @click="emit('close')"
        class="absolute top-3 right-3 text-gray-400 hover:text-gray-600 focus:outline-none button-custom-close ">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div class="mt-3 text-center">
        <h3 class="text-lg leading-6 font-medium text-gray-900 text-white">
          Errores encontrados en: {{ url.name }}
        </h3>
        <div class="mt-2 px-7 py-3">
          <ul class="text-left mt-4 mb-4 space-y-4">
            <li v-for="(message, index) in url.errorMessages" :key="index" class="p-3 border rounded-lg bg-gray-50">
              <!-- Mensaje de texto -->
              <p class="text-sm text-gray-700 mb-2">
                {{ typeof message === 'object' ? message.text : message }}
              </p>

              <!-- Imagen si existe -->
              <div v-if="typeof message === 'object' && (message.imageUrl || message.imagePreview)" class="mt-2">
                <!-- Imagen con cursor para indicar que es clickeable -->
                <img :src="getDisplayUrl(message.imageUrl, message.imagePreview)" alt="Imagen del error"
                  class="max-w-full rounded-md mx-auto max-h-64 cursor-pointer hover:opacity-90 transition-opacity"
                  @click="openZoom(message.imageUrl, message.imagePreview)" />

                <!-- Indicador de que se puede ampliar -->
                <span class="text-xs text-blue-600 block mt-1">
                  Haz clic en la imagen para ampliarla
                </span>
              </div>
            </li>
          </ul>

          <div class="flex justify-end mt-4">
            <button @click="emit('close')"
              class="button-custom  font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal para ver la imagen ampliada -->
  <div v-if="isZooming"
    class="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[60] cursor-zoom-out"
    @click="closeZoom">
    <div class="relative max-w-[90vw] max-h-[90vh] overflow-auto">
      <!-- Botón X para cerrar la imagen ampliada -->
      <button @click.stop="closeZoom"
        class="absolute top-3 right-3 text-white hover:text-gray-200 focus:outline-none z-10 bg-gray-800 bg-opacity-50 rounded-full p-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <!-- Imagen ampliada -->
      <img :src="zoomedImageSrc" alt="Imagen ampliada" class="max-w-full max-h-[90vh] object-contain" @click.stop />

      <!-- Instrucciones -->
      <div class="absolute bottom-4 left-0 right-0 text-center text-white text-sm">
        Haz clic fuera de la imagen para cerrar
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Animación de transición para la imagen ampliada */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
.button-custom {
  color: black;
  background: #BBF33A;
  transition: 0.4s ease;
}

.button-custom:hover {
  color: white;

}

.button-custom-close {
  color: #BBF33A;
}
</style>
