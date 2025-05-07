<script setup>
import { ref } from 'vue';
import useImages from '../composables/useImages';

const props = defineProps({
  isOpen: Boolean,
  errorMessages: Array
});

const emit = defineEmits(['close', 'addError', 'removeError', 'submitErrors']);

// Inicialización del composable useImages
const { uploadImage, uploadImages, uploadingStatus } = useImages('error-images');

const newErrorMessage = ref('');
const selectedFile = ref(null);
const errors = ref([]);
const previewUrl = ref('');
const isAddingError = ref(false);
const isSubmitting = ref(false);

// Función para previsualizar la imagen
const handleFileChange = (event) => {
  const file = event.target.files[0];
  if (file) {
    console.log('Archivo seleccionado:', file);
    console.log('Tipo de archivo:', file.type);
    console.log('Tamaño de archivo:', file.size, 'bytes');
    
    selectedFile.value = file;
    previewUrl.value = URL.createObjectURL(file);
  }
};

// Función para añadir un error a la cola
const addErrorToQueue = async () => {
  if (newErrorMessage.value.trim() !== '') {
    isAddingError.value = true;
    
    try {
      console.log('=== DEPURACIÓN: AÑADIR ERROR ===');
      console.log('Mensaje:', newErrorMessage.value);
      
      let imageUrl = null;
      
      // Si hay una imagen seleccionada, subirla usando el composable
      if (selectedFile.value) {
        console.log('Subiendo imagen a Firebase Storage');
        
        // Usar el composable para subir la imagen
        const uploadedUrls = await uploadImages([selectedFile.value]);
        if (uploadedUrls && uploadedUrls.length > 0) {
          imageUrl = uploadedUrls[0];
          console.log('Imagen subida con éxito:', imageUrl);
        }
      }
      
      // Crear un nuevo objeto de error con mensaje e imagen
      const newError = {
        text: newErrorMessage.value.trim(),
        imageUrl: imageUrl,
        // Mantener la previsualización solo para esta sesión
        imagePreview: previewUrl.value
      };
      
      console.log('Objeto de error creado:', newError);
      
      // Añadir a la cola local
      errors.value.push(newError);
      
      // Añadir al store de Pinia - pasar objeto completo y esperar a que termine
      console.log('Enviando objeto de error al store...');
      await emit('addError', newError);
      console.log('Objeto de error enviado al store');
      
      // Limpiar los campos para poder añadir otro error
      newErrorMessage.value = '';
      selectedFile.value = null;
      previewUrl.value = '';
      
      // Restablecer el input de archivo
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Error al añadir mensaje:', error);
    } finally {
      isAddingError.value = false;
    }
  }
};

// Función para eliminar un error de la cola
const removeError = (index) => {
  errors.value.splice(index, 1);
  emit('removeError', index);
};

// Función para enviar todos los errores acumulados
const submitAllErrors = async () => {
  if (errors.value.length > 0) {
    isSubmitting.value = true;
    try {
      emit('submitErrors');
      
      // Limpiar la cola local después de enviar
      errors.value = [];
    } catch (error) {
      console.error('Error al enviar los errores:', error);
    } finally {
      isSubmitting.value = false;
    }
  } else {
    console.log('No hay errores para enviar');
  }
};
</script>

<template>
  <div v-if="isOpen"
    class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50 ">
    <div
      class="relative mx-auto p-5  w-full max-w-md shadow-lg rounded-md  bg-gradient-to-r from-pink-600 via-pink-700 to-purple-800">
      <!-- Botón X para cerrar (arriba a la derecha) -->
      <button @click="emit('close')"
        class="absolute top-3 right-3 text-gray-400 hover:text-gray-600 focus:outline-none button-custom-close ">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div class="mt-3 text-center">
        <h3 class="text-lg leading-6 font-medium text-white">Registrar errores</h3>
        <div class="mt-2 px-7 py-3">
          <p class="text-sm text-gray-500 mb-4 text-white">
            Por favor, indique los errores encontrados en esta URL.
          </p>

          <div class="mb-4 border rounded-md p-4 bg-gray-50">
            <!-- Formulario para nuevo error -->
            <div class="mb-3">
              <label class="block text-sm font-medium text-gray-700 text-left mb-1">
                Descripción del error
              </label>
              <input type="text" v-model="newErrorMessage" placeholder="Describe el error"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
            </div>

            <!-- Sección de carga de imágenes -->
            <div class="mb-3">
              <label class="block text-sm font-medium text-gray-700 text-left mb-1">
                Añadir imagen (opcional)
              </label>
              <input type="file" @change="handleFileChange" accept="image/*"
                class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>

            <!-- Vista previa de la imagen -->
            <div v-if="previewUrl" class="mb-3">
              <img :src="previewUrl" alt="Vista previa" class="max-h-32 mx-auto rounded-md" />
            </div>

            <!-- Botón para añadir error a la lista -->
            <button @click="addErrorToQueue"
              class="w-full mb-2 bg-gradient-to-r from-pink-600 via-pink-700 to-purple-800 cursor-pointer transition-all hover:text-black text-white px-4 py-2 rounded-md text-md font-bold"
              :disabled="!newErrorMessage.trim() || isAddingError || uploadingStatus">
              <span v-if="isAddingError || uploadingStatus">
                {{ uploadingStatus ? 'Subiendo imagen...' : 'Añadiendo...' }}
              </span>
              <span v-else>Añadir error a la lista</span>
            </button>
          </div>

          <!-- Lista de errores añadidos -->
          <div v-if="errors.length > 0" class="border rounded-md p-3 mb-4 bg-gray-50">
            <h4 class="text-sm font-medium text-gray-700 mb-2 text-left">
              Errores pendientes de registrar ({{ errors.length }}):
            </h4>
            <ul class="text-left pl-2 max-h-60 overflow-y-auto">
              <li v-for="(error, index) in errors" :key="index"
                class="mb-3 pb-2 border-b border-gray-200 last:border-0">
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <p class="text-sm text-gray-700">{{ error.text }}</p>

                    <!-- Mostrar imagen (solo previsualización durante esta sesión) -->
                    <div v-if="error.imageUrl || error.imagePreview" class="mt-1">
                      <img :src="error.imageUrl || error.imagePreview" alt="Imagen de error" class="h-20 rounded-md" />
                    </div>
                  </div>
                  <button @click="removeError(index)" class="text-red-500 hover:text-red-700 ml-2 flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </li>
            </ul>
          </div>

          <!-- Botón para enviar todos los errores con estado de carga -->
          <button @click="submitAllErrors"
            class="w-full mt-2 button-custom hover:cursor-pointer text-white px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 text-md font-bold"
            :disabled="errors.length === 0 || isSubmitting">
            {{ isSubmitting ? 'Registrando errores...' : 'Registrar todos los errores' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.button-custom {
  color: black;
  background: #BBF33A;
  transition: 0.4s ease;
}

.button-custom:hover {
  color: white;

}
.button-custom-close{
  color:#BBF33A;
}
</style>