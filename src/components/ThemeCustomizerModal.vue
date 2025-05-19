<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useThemeStore } from '../stores/theme';

const props = defineProps({
  isOpen: Boolean
});

const emit = defineEmits(['close', 'theme-updated']);

// Obtener el store de temas
const themeStore = useThemeStore();

// Estado local para edición
const editingTheme = ref({
  primary: '#EC4899',
  secondary: '#9333EA',
  accent: '#BBF33A',
  background: '#F3F4F6',
  text: '#111827',
  primary2: '#EC4899',
  secondary2: '#9333EA',
  accent2: '#BBF33A',
  background2: '#F3F4F6',
  text2: '#111827',
  name: ''
});

// Estado para el formulario de guardar tema
const newThemeName = ref('');
const showSaveForm = ref(false);
const saveError = ref('');
const isSaving = ref(false);

// Estado para previsualización
const previewActive = ref(false);

// Copiar tema actual para edición cuando se abre el modal
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    editingTheme.value = { ...themeStore.currentTheme };
  }
}, { immediate: true });

// Función para actualizar un color
const updateColor = (key, value) => {
  editingTheme.value[key] = value;
};

// Función para aplicar los cambios
const applyChanges = () => {
  // Actualizar el tema en el store
  Object.entries(editingTheme.value).forEach(([key, value]) => {
    if (key !== 'name') {
      themeStore.updateColor(key, value);
    }
  });
  
  // Aplicar el tema
  themeStore.applyTheme();
  
  // Emitir evento
  emit('theme-updated');
  
  // Mostrar mensaje de éxito
  showSuccessMessage('Cambios aplicados correctamente');
};

// Función para mostrar la previsualización
const togglePreview = () => {
  previewActive.value = !previewActive.value;
};

// Función para mostrar el formulario de guardar tema
const showSaveThemeForm = () => {
  showSaveForm.value = true;
  newThemeName.value = '';
  saveError.value = '';
};

// Función para guardar el tema actual con nombre
const saveTheme = async () => {
  if (!newThemeName.value.trim()) {
    saveError.value = 'Por favor, ingresa un nombre para el tema';
    return;
  }
  
  isSaving.value = true;
  try {
    // Primero aplicar los cambios
    applyChanges();
    
    // Luego guardar con el nombre proporcionado
    const success = await themeStore.saveCurrentTheme(newThemeName.value);
    
    if (success) {
      showSaveForm.value = false;
      newThemeName.value = '';
      saveError.value = '';
      showSuccessMessage('Tema guardado correctamente');
    } else {
      saveError.value = themeStore.error || 'Error al guardar el tema';
    }
  } catch (error) {
    console.error('Error al guardar tema:', error);
    saveError.value = 'Error inesperado al guardar';
  } finally {
    isSaving.value = false;
  }
};

// Función para cargar un tema guardado
const loadTheme = (theme) => {
  editingTheme.value = { ...theme };
  showSuccessMessage(`Tema "${theme.name}" cargado. No olvides aplicar los cambios.`);
};

// Función para restablecer al tema por defecto
const resetToDefault = () => {
  themeStore.resetToDefault();
  editingTheme.value = { ...themeStore.currentTheme };
  showSuccessMessage('Tema restablecido a valores predeterminados');
};

// Estado para mensajes de éxito
const successMessage = ref('');
const showSuccess = ref(false);

// Función para mostrar mensaje de éxito temporal
const showSuccessMessage = (message) => {
  successMessage.value = message;
  showSuccess.value = true;
  
  setTimeout(() => {
    showSuccess.value = false;
  }, 3000);
};

// Obtener temas guardados al montar el componente
onMounted(async () => {
  if (themeStore.savedThemes.length === 0) {
    await themeStore.fetchSavedThemes();
  }
});

// Establecer estilo con el tema en edición para previsualización
const previewStyle = computed(() => {
  return {
    '--preview-primary': editingTheme.value.primary,
    '--preview-secondary': editingTheme.value.secondary,
    '--preview-accent': editingTheme.value.accent,
    '--preview-background': editingTheme.value.background,
    '--preview-text': editingTheme.value.text,
    '--preview-primary-2': editingTheme.value.primary2,
    '--preview-secondary-2': editingTheme.value.secondary2,
    '--preview-accent-2': editingTheme.value.accent2,
    '--preview-background-2': editingTheme.value.background2,
    '--preview-text-2': editingTheme.value.text2,
  };
});
</script>

<template>
  <div v-if="isOpen"
    class="fixed inset-0 bg-black bg-opacity-60 overflow-y-auto h-full w-full flex items-center justify-center z-50">
    <div
      class="relative mx-auto p-5 border w-full max-w-3xl shadow-lg rounded-md bg-gradient-to-r"
      :style="{
        background: `linear-gradient(to right, ${editingTheme.primary}, ${editingTheme.secondary})`
      }">
      <!-- Botón X para cerrar (arriba a la derecha) -->
      <button @click="emit('close')"
        class="absolute top-3 right-3 text-white hover:text-gray-200 focus:outline-none z-10">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div class="mt-3">
        <h3 class="text-lg leading-6 font-medium text-white mb-4">
          Personalizar Tema
        </h3>

        <div class="bg-white rounded-md p-5 shadow-inner mb-4">
          <!-- Sección de colores principales -->
          <div class="mb-6">
            <h4 class="text-gray-800 font-medium mb-3">Colores de la Interfaz - Elementos Principales</h4>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Color primario -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Color Primario (Degradado Inicio)
                </label>
                <div class="flex items-center">
                  <input
                    type="color"
                    v-model="editingTheme.primary"
                    @input="updateColor('primary', $event.target.value)"
                    class="w-12 h-12 rounded-md cursor-pointer mr-3"
                    title="Seleccionar color primario"
                  />
                  <input
                    type="text"
                    v-model="editingTheme.primary"
                    @input="updateColor('primary', $event.target.value)"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="#RRGGBB"
                  />
                </div>
              </div>
              
              <!-- Color secundario -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Color Secundario (Degradado Fin)
                </label>
                <div class="flex items-center">
                  <input
                    type="color"
                    v-model="editingTheme.secondary"
                    @input="updateColor('secondary', $event.target.value)"
                    class="w-12 h-12 rounded-md cursor-pointer mr-3"
                    title="Seleccionar color secundario"
                  />
                  <input
                    type="text"
                    v-model="editingTheme.secondary"
                    @input="updateColor('secondary', $event.target.value)"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="#RRGGBB"
                  />
                </div>
              </div>
              
              <!-- Color de acento (botones) -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Color de Acento (Botones)
                </label>
                <div class="flex items-center">
                  <input
                    type="color"
                    v-model="editingTheme.accent"
                    @input="updateColor('accent', $event.target.value)"
                    class="w-12 h-12 rounded-md cursor-pointer mr-3"
                    title="Seleccionar color de acento"
                  />
                  <input
                    type="text"
                    v-model="editingTheme.accent"
                    @input="updateColor('accent', $event.target.value)"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="#RRGGBB"
                  />
                </div>
              </div>
              
              <!-- Color de fondo -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Color de Fondo
                </label>
                <div class="flex items-center">
                  <input
                    type="color"
                    v-model="editingTheme.background"
                    @input="updateColor('background', $event.target.value)"
                    class="w-12 h-12 rounded-md cursor-pointer mr-3"
                    title="Seleccionar color de fondo"
                  />
                  <input
                    type="text"
                    v-model="editingTheme.background"
                    @input="updateColor('background', $event.target.value)"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="#RRGGBB"
                  />
                </div>
              </div>
              
              <!-- Color de texto -->
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Color de Texto
                </label>
                <div class="flex items-center">
                  <input
                    type="color"
                    v-model="editingTheme.text"
                    @input="updateColor('text', $event.target.value)"
                    class="w-12 h-12 rounded-md cursor-pointer mr-3"
                    title="Seleccionar color de texto"
                  />
                  <input
                    type="text"
                    v-model="editingTheme.text"
                    @input="updateColor('text', $event.target.value)"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="#RRGGBB"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <!-- Sección de colores secundarios -->
          <div class="mb-6">
            <h4 class="text-gray-800 font-medium mb-3">Colores de la Interfaz - Elementos Secundarios</h4>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Color primario secundario -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Color Primario (Degradado Inicio)
                </label>
                <div class="flex items-center">
                  <input
                    type="color"
                    v-model="editingTheme.primary2"
                    @input="updateColor('primary2', $event.target.value)"
                    class="w-12 h-12 rounded-md cursor-pointer mr-3"
                    title="Seleccionar color primario secundario"
                  />
                  <input
                    type="text"
                    v-model="editingTheme.primary2"
                    @input="updateColor('primary2', $event.target.value)"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="#RRGGBB"
                  />
                </div>
              </div>
              
              <!-- Color secundario secundario -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Color Secundario (Degradado Fin)
                </label>
                <div class="flex items-center">
                  <input
                    type="color"
                    v-model="editingTheme.secondary2"
                    @input="updateColor('secondary2', $event.target.value)"
                    class="w-12 h-12 rounded-md cursor-pointer mr-3"
                    title="Seleccionar color secundario secundario"
                  />
                  <input
                    type="text"
                    v-model="editingTheme.secondary2"
                    @input="updateColor('secondary2', $event.target.value)"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="#RRGGBB"
                  />
                </div>
              </div>
              
              <!-- Color de acento secundario (botones) -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Color de Acento (Botones)
                </label>
                <div class="flex items-center">
                  <input
                    type="color"
                    v-model="editingTheme.accent2"
                    @input="updateColor('accent2', $event.target.value)"
                    class="w-12 h-12 rounded-md cursor-pointer mr-3"
                    title="Seleccionar color de acento secundario"
                  />
                  <input
                    type="text"
                    v-model="editingTheme.accent2"
                    @input="updateColor('accent2', $event.target.value)"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="#RRGGBB"
                  />
                </div>
              </div>
              
              <!-- Color de fondo secundario -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Color de Fondo
                </label>
                <div class="flex items-center">
                  <input
                    type="color"
                    v-model="editingTheme.background2"
                    @input="updateColor('background2', $event.target.value)"
                    class="w-12 h-12 rounded-md cursor-pointer mr-3"
                    title="Seleccionar color de fondo secundario"
                  />
                  <input
                    type="text"
                    v-model="editingTheme.background2"
                    @input="updateColor('background2', $event.target.value)"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="#RRGGBB"
                  />
                </div>
              </div>
              
              <!-- Color de texto secundario -->
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Color de Texto
                </label>
                <div class="flex items-center">
                  <input
                    type="color"
                    v-model="editingTheme.text2"
                    @input="updateColor('text2', $event.target.value)"
                    class="w-12 h-12 rounded-md cursor-pointer mr-3"
                    title="Seleccionar color de texto secundario"
                  />
                  <input
                    type="text"
                    v-model="editingTheme.text2"
                    @input="updateColor('text2', $event.target.value)"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="#RRGGBB"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <!-- Previsualización de tema -->
          <div class="mb-4">
            <div class="flex justify-between items-center mb-2">
              <h4 class="text-gray-800 font-medium">Previsualización</h4>
              <button @click="togglePreview" 
                class="text-sm text-indigo-600 hover:text-indigo-800 focus:outline-none">
                {{ previewActive ? 'Ocultar previsualización' : 'Mostrar previsualización' }}
              </button>
            </div>
            
            <transition name="fade">
              <div v-if="previewActive" 
                class="p-3 rounded-md border border-gray-300 shadow-inner"
                :style="previewStyle">
                <!-- Simulación mini UI -->
                <div class="bg-[var(--preview-background)] p-4 rounded-md">
                  <div class="bg-gradient-to-r rounded-md p-3 mb-3"
                    :style="{ 
                      background: `linear-gradient(to right, var(--preview-primary), var(--preview-secondary))` 
                    }">
                    <h3 class="text-white font-medium mb-2">Header de muestra</h3>
                    <p class="text-white text-sm">Este es un ejemplo de cabecera con degradado personalizado.</p>
                  </div>
                  
                  <div class="p-3 mb-3 bg-white rounded-md shadow-sm">
                    <p class="text-[var(--preview-text)] mb-2">Contenido de ejemplo con texto personalizado.</p>
                    <button class="px-3 py-1 rounded-md font-medium text-[var(--preview-text)]"
                      :style="{ backgroundColor: editingTheme.accent }">
                      Botón de Ejemplo
                    </button>
                  </div>

                  <!-- Agregado: Previsualización de elementos secundarios -->
                  <div class="bg-gradient-to-r rounded-md p-3 mb-3"
                    :style="{ 
                      background: `linear-gradient(to right, var(--preview-primary-2), var(--preview-secondary-2))` 
                    }">
                    <h3 class="text-white font-medium mb-2">Header secundario</h3>
                    <p class="text-white text-sm">Ejemplo de elementos secundarios personalizados.</p>
                  </div>
                  
                  <div class="p-3 bg-white rounded-md shadow-sm">
                    <p class="text-[var(--preview-text-2)] mb-2">Contenido secundario con texto personalizado.</p>
                    <button class="px-3 py-1 rounded-md font-medium text-[var(--preview-text-2)]"
                      :style="{ backgroundColor: editingTheme.accent2 }">
                      Botón Secundario
                    </button>
                  </div>
                </div>
              </div>
            </transition>
          </div>
          
          <!-- Temas guardados -->
          <div class="mb-4">
            <h4 class="text-gray-800 font-medium mb-2">Temas Guardados</h4>
            
            <div v-if="themeStore.savedThemes.length === 0" class="text-center py-4 text-gray-500 italic bg-gray-100 rounded-md">
              No hay temas guardados. Personaliza y guarda tu propio tema.
            </div>
            
            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div v-for="theme in themeStore.savedThemes" :key="theme.id"
                class="border rounded-md p-2 cursor-pointer hover:border-indigo-500 transition-colors"
                @click="loadTheme(theme)">
                <div class="h-6 rounded-sm mb-1"
                  :style="{ 
                    background: `linear-gradient(to right, ${theme.primary}, ${theme.secondary})` 
                  }">
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-sm font-medium truncate">{{ theme.name }}</span>
                  <div class="flex items-center space-x-1">
                    <span class="block w-3 h-3 rounded-full" :style="{ backgroundColor: theme.accent }"></span>
                    <span class="block w-3 h-3 rounded-full" :style="{ backgroundColor: theme.accent2 }"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Botones de acción -->
          <div class="flex flex-wrap gap-2 justify-between">
            <div class="space-x-2">
              <button @click="resetToDefault"
                class="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none">
                Restablecer Predeterminado
              </button>
              
              <button @click="showSaveThemeForm"
                class="px-3 py-2 border border-indigo-500 bg-indigo-50 rounded-md text-indigo-700 hover:bg-indigo-100 focus:outline-none">
                Guardar Tema
              </button>
            </div>
            
            <button @click="applyChanges"
                :style="{ backgroundColor: editingTheme.accent }"
                class="px-4 py-2 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2">
                Aplicar Cambios
            </button>
          </div>
          
          <!-- Formulario para guardar tema -->
          <div v-if="showSaveForm" class="mt-4 p-3 border border-gray-300 rounded-md bg-gray-50">
            <h5 class="text-gray-800 font-medium mb-2">Guardar Tema Actual</h5>
            
            <div class="mb-3">
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Nombre del Tema
              </label>
              <input
                type="text"
                v-model="newThemeName"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Mi tema personalizado"
              />
              <p v-if="saveError" class="mt-1 text-sm text-red-600">{{ saveError }}</p>
            </div>
            
            <div class="flex justify-end space-x-2">
              <button @click="showSaveForm = false"
                class="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none">
                Cancelar
              </button>
              
              <button @click="saveTheme" :disabled="isSaving"
                class="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed">
                {{ isSaving ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </div>
        </div>
        
        <!-- Mensaje de éxito -->
        <transition name="fade">
          <div v-if="showSuccess" 
            class="mb-4 p-3 bg-green-100 border border-green-200 text-green-800 rounded-md">
            {{ successMessage }}
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Estilos personalizados para los inputs de color */
input[type="color"] {
  -webkit-appearance: none;
  appearance: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}

input[type="color"]::-webkit-color-swatch {
  border: none;
  border-radius: 0.375rem;
}
</style>