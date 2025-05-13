<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import useImages from '../composables/useImages';

defineProps({
  errorMessages: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['remove-error']);

// Inicializar el composable
const { getImageDisplayUrl } = useImages('error-images');

// Estado para controlar la imagen ampliada
const zoomedImageSrc = ref(null);
const isZooming = ref(false);

// Estado para el deslizamiento
const swipeState = ref({});
const startX = ref(0);
const endX = ref(0);
const isDragging = ref(false);
const SWIPE_THRESHOLD = 120; // Píxeles necesarios para considerar un deslizamiento completo
const REMOVE_THRESHOLD = 180; // Píxeles necesarios para eliminar automáticamente

// Para la animación de eliminación
const itemsToRemove = ref(new Set());

// Función para obtener la URL de la imagen
const getDisplayUrl = (imageUrl, fallbackUrl) => {
  return imageUrl || fallbackUrl;
};

// Función para abrir la imagen en vista ampliada (solo cuando no se está deslizando)
const openZoom = (imageUrl, fallbackUrl, index) => {
  // Solo permitir el zoom si no estamos en medio de un deslizamiento
  if (!isDragging.value && (!swipeState.value[index] || swipeState.value[index].offset === 0)) {
    zoomedImageSrc.value = getDisplayUrl(imageUrl, fallbackUrl);
    isZooming.value = true;
  }
};

// Función para cerrar la vista ampliada
const closeZoom = () => {
  isZooming.value = false;
  zoomedImageSrc.value = null;
};

// Funciones para eventos táctiles
const handleTouchStart = (event, index) => {
  // No permitir deslizamiento si el elemento está marcado para eliminar
  if (itemsToRemove.value.has(index)) return;
  
  event.stopPropagation();
  startX.value = event.touches[0].clientX;
  isDragging.value = true;
  
  // Inicializar el estado de deslizamiento para este elemento si no existe
  if (!swipeState.value[index]) {
    swipeState.value[index] = {
      offset: 0,
      transitioning: false
    };
  }
};

const handleTouchMove = (event, index) => {
  // No permitir deslizamiento si el elemento está marcado para eliminar
  if (itemsToRemove.value.has(index)) return;
  if (!isDragging.value || swipeState.value[index]?.transitioning) return;
  
  event.stopPropagation();
  const currentX = event.touches[0].clientX;
  const diff = currentX - startX.value;
  
  // Solo permitir deslizamiento hacia la izquierda (valores negativos)
  if (diff < 0) {
    // Cambiar el color de fondo dinámicamente según la cantidad de deslizamiento
    const swipeProgress = Math.min(Math.abs(diff) / REMOVE_THRESHOLD, 1);
    
    // Limitar el desplazamiento máximo a -300px
    const newOffset = Math.max(diff, -300);
    swipeState.value[index] = {
      ...swipeState.value[index],
      offset: newOffset,
      progress: swipeProgress
    };
  } else if (swipeState.value[index]?.offset < 0) {
    // Si ya estaba desplazado y el usuario desliza hacia la derecha, permitir regresar
    const newOffset = Math.min(0, swipeState.value[index].offset + diff);
    const swipeProgress = Math.min(Math.abs(newOffset) / REMOVE_THRESHOLD, 1);
    
    swipeState.value[index] = {
      ...swipeState.value[index],
      offset: newOffset,
      progress: swipeProgress
    };
    
    startX.value = currentX; // Actualizar referencia
  }
};

const handleTouchEnd = (event, index) => {
  // No permitir deslizamiento si el elemento está marcado para eliminar
  if (itemsToRemove.value.has(index)) return;
  if (!isDragging.value) return;
  
  event.stopPropagation();
  endX.value = event.changedTouches[0].clientX;
  const diff = endX.value - startX.value;
  
  completeSwipe(diff, index);
  isDragging.value = false;
};

// Funciones para eventos de ratón (para dispositivos de escritorio)
const handleMouseDown = (event, index) => {
  // No permitir deslizamiento si el elemento está marcado para eliminar
  if (itemsToRemove.value.has(index)) return;
  
  // Solo permitir deslizamiento con el botón primario del ratón
  if (event.button !== 0) return;
  
  event.stopPropagation();
  event.preventDefault(); 
  startX.value = event.clientX;
  isDragging.value = true;
  
  // Inicializar el estado de deslizamiento para este elemento si no existe
  if (!swipeState.value[index]) {
    swipeState.value[index] = {
      offset: 0,
      transitioning: false,
      progress: 0
    };
  }
  
  // Añadir event listeners temporales para el arrastre del ratón
  document.addEventListener('mousemove', e => handleMouseMove(e, index));
  document.addEventListener('mouseup', e => handleMouseUp(e, index), { once: true });
};

const handleMouseMove = (event, index) => {
  // No permitir deslizamiento si el elemento está marcado para eliminar
  if (itemsToRemove.value.has(index)) return;
  if (!isDragging.value || swipeState.value[index]?.transitioning) return;
  
  event.stopPropagation();
  const currentX = event.clientX;
  const diff = currentX - startX.value;
  
  // Solo permitir deslizamiento hacia la izquierda (valores negativos)
  if (diff < 0) {
    // Cambiar el color de fondo dinámicamente según la cantidad de deslizamiento
    const swipeProgress = Math.min(Math.abs(diff) / REMOVE_THRESHOLD, 1);
    
    // Limitar el desplazamiento máximo a -300px
    const newOffset = Math.max(diff, -300);
    swipeState.value[index] = {
      ...swipeState.value[index],
      offset: newOffset,
      progress: swipeProgress
    };
  } else if (swipeState.value[index]?.offset < 0) {
    // Si ya estaba desplazado y el usuario desliza hacia la derecha, permitir regresar
    const newOffset = Math.min(0, swipeState.value[index].offset + diff);
    const swipeProgress = Math.min(Math.abs(newOffset) / REMOVE_THRESHOLD, 1);
    
    swipeState.value[index] = {
      ...swipeState.value[index],
      offset: newOffset,
      progress: swipeProgress
    };
    
    startX.value = currentX; // Actualizar referencia
  }
};

const handleMouseUp = (event, index) => {
  // No permitir deslizamiento si el elemento está marcado para eliminar
  if (itemsToRemove.value.has(index)) return;
  if (!isDragging.value) return;
  
  event.stopPropagation();
  endX.value = event.clientX;
  const diff = endX.value - startX.value;
  
  completeSwipe(diff, index);
  isDragging.value = false;
  
  // Eliminar los event listeners
  document.removeEventListener('mousemove', e => handleMouseMove(e, index));
};

// Función para completar el deslizamiento (común para táctil y ratón)
const completeSwipe = (diff, index) => {
  // Si el deslizamiento supera el umbral para eliminar automáticamente
  if (diff < -REMOVE_THRESHOLD) {
    // Marcar para eliminar y realizar animación
    markForRemoval(index);
  } 
  // Si supera el umbral normal, mantener abierto
  else if (diff < -SWIPE_THRESHOLD) {
    swipeState.value[index] = {
      offset: -200, // Mostrar estado intermedio
      transitioning: true,
      progress: 0.6
    };
    
    // Si el usuario deja el elemento en la zona "cerca de eliminar", también lo eliminamos después de un tiempo
    setTimeout(() => {
      if (swipeState.value[index] && swipeState.value[index].offset <= -200) {
        markForRemoval(index);
      }
    }, 1000);
  } 
  // De lo contrario, volver a la posición inicial
  else {
    swipeState.value[index] = {
      offset: 0,
      transitioning: true,
      progress: 0
    };
    
    // Después de la transición, resetear el estado
    setTimeout(() => {
      if (swipeState.value[index]) {
        swipeState.value[index].transitioning = false;
      }
    }, 300); // Coincidir con la duración de la transición CSS
  }
};

// Función para marcar un elemento para eliminación con animación
const markForRemoval = (index) => {
  // Para evitar que se procese múltiples veces
  if (itemsToRemove.value.has(index)) return;
  
  // Agregar a la lista de elementos para eliminar
  itemsToRemove.value.add(index);
  
  // Configurar la animación final
  swipeState.value[index] = {
    offset: -window.innerWidth, // Deslizar completamente fuera de la pantalla
    transitioning: true,
    progress: 1
  };
  
  // Después de la animación, eliminar el elemento
  setTimeout(() => {
    // Verificar para asegurarnos de que el elemento sigue presente
    if (itemsToRemove.value.has(index)) {
      console.log(`Emitiendo evento remove-error para el índice ${index}`);
      // Emitir el evento al componente padre
      emit('remove-error', index);
      
      // Limpieza después de la eliminación
      itemsToRemove.value.delete(index);
      delete swipeState.value[index];
    }
  }, 400);
};

// Función para resetear todos los deslizamientos
const resetAllSwipes = () => {
  for (const index in swipeState.value) {
    // No resetear los elementos marcados para eliminar
    if (itemsToRemove.value.has(parseInt(index))) continue;
    
    swipeState.value[index] = {
      offset: 0,
      transitioning: true,
      progress: 0
    };
  }
  
  // Después de la transición, resetear los estados
  setTimeout(() => {
    for (const index in swipeState.value) {
      if (swipeState.value[index] && !itemsToRemove.value.has(parseInt(index))) {
        swipeState.value[index].transitioning = false;
      }
    }
  }, 300);
};

// Escuchar clicks en el documento para resetear deslizamientos
const handleDocumentClick = (event) => {
  // Verificar si el clic fue dentro de un elemento deslizable
  const isInsideSwipeable = event.target.closest('.swipeable-item');
  if (!isInsideSwipeable) {
    resetAllSwipes();
  }
};

// Configurar y limpiar event listeners
onMounted(() => {
  document.addEventListener('click', handleDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick);
});
</script>

<template>
  <ul class="text-left mt-4 mb-4 space-y-4">
    <li v-for="(message, index) in errorMessages" :key="index" 
        class="swipeable-container relative overflow-hidden rounded-lg"
        :class="{ 'removing': itemsToRemove.has(index) }">
      <!-- Fondo dinámico que cambia de color según el deslizamiento -->
      <div class="absolute inset-0 bg-red-500 flex items-center justify-center"
           :style="{ 
             opacity: swipeState[index]?.progress || 0,
             transition: swipeState[index]?.transitioning ? 'opacity 0.3s ease' : 'none'
           }">
        <div class="flex flex-col items-center justify-center text-white">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span class="text-sm mt-1">Soltar para eliminar</span>
        </div>
      </div>
      
      <!-- Contenido deslizable -->
      <div class="swipeable-item p-3 border rounded-lg bg-gray-50 touch-manipulation cursor-grab active:cursor-grabbing"
           :style="{ 
             transform: `translateX(${swipeState[index]?.offset || 0}px)`, 
             transition: swipeState[index]?.transitioning ? 'transform 0.3s ease, opacity 0.3s ease' : 'none',
             opacity: 1 - (swipeState[index]?.progress || 0) * 0.3
           }"
           @touchstart="handleTouchStart($event, index)"
           @touchmove="handleTouchMove($event, index)"
           @touchend="handleTouchEnd($event, index)"
           @mousedown="handleMouseDown($event, index)">
        <!-- Contenedor del contenido para capturar eventos en todos los elementos hijos -->
        <div class="swipeable-content">
          <!-- Mensaje de texto -->
          <p class="text-sm text-gray-700 mb-2">
            {{ typeof message === 'object' ? message.text : message }}
          </p>

          <!-- Imagen si existe -->
          <div v-if="typeof message === 'object' && (message.imageUrl || message.imagePreview)" class="mt-2">
            <!-- Imagen con cursor para indicar que es clickeable -->
            <img :src="getDisplayUrl(message.imageUrl, message.imagePreview)" alt="Imagen del error"
                class="max-w-full rounded-md mx-auto max-h-64 cursor-pointer hover:opacity-90 transition-opacity"
                @click.stop="openZoom(message.imageUrl, message.imagePreview, index)"
                @touchstart.stop
                @mousedown.stop />

            <!-- Indicador de que se puede ampliar -->
            <span class="text-xs text-blue-600 block mt-1">
              Haz clic en la imagen para ampliarla
            </span>
          </div>
        </div>
      </div>
    </li>
  </ul>

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

/* Estilos para el contenedor deslizable */
.swipeable-container {
  position: relative;
  overflow: hidden;
  height: auto;
  transition: height 0.3s ease, opacity 0.3s ease, margin 0.3s ease;
}

.swipeable-container.removing {
  animation: collapse 0.3s ease forwards;
}

@keyframes collapse {
  0% {
    opacity: 1;
    max-height: 500px;
    margin-bottom: 1rem;
  }
  100% {
    opacity: 0;
    max-height: 0;
    margin-bottom: 0;
  }
}

.swipeable-item {
  background-color: white;
  width: 100%;
  position: relative;
  z-index: 1;
  touch-action: pan-y;
  user-select: none;
}

/* Estilo para indicar visualmente que un elemento es deslizable */
.swipeable-content {
  position: relative;
}

.swipeable-content::before {
  content: '«swipe»';
  position: absolute;
  right: 0px;
  top: 0px;
  color: rgba(180, 180, 180, 0.8);
  font-size: 10px;
  opacity: 0.7;
  background-color: rgba(240, 240, 240, 0.6);
  padding: 2px 6px;
  border-radius: 10px;
}
</style>