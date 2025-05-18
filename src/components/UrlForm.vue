<script setup>
import { ref } from 'vue';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUrlStore } from '../stores/url'; // Importamos el store
import ThemeCustomizerModal from './components/ThemeCustomizerModal.vue'; // Importar el nuevo componente
import { useThemeStore } from '../stores/theme'; // Importar el store de temas


// Obtenemos el store de URLs
const urlStore = useUrlStore();
const themeStore = useThemeStore(); // Inicializar el store de temas

// Estados
const name = ref('');
const site_name = ref('');
const originalUrl = ref('');
const isSubmitting = ref(false);
const errorMsg = ref('');
const successMsg = ref('');

// Función para enviar el formulario directamente a Firebase
const submitForm = async () => {
  if (isSubmitting.value) return; // Evitar envíos múltiples

  // Validación básica
  if (!name.value.trim() || !originalUrl.value.trim()) {
    errorMsg.value = 'Por favor, completa todos los campos';
    return;
  }

  // Preparar los datos
  const newUrl = {
    site_name: site_name.value.trim(),
    name: name.value.trim(),
    original: originalUrl.value.trim(),
    createdAt: new Date(),
    status: 'pending',
    visits: 0,
    visitDetails: [] // Añadimos array para almacenar detalles de visita
  };

  // Enviar a Firebase
  isSubmitting.value = true;
  errorMsg.value = '';
  try {
    // Utiliza directamente Firebase sin pasar por el store
    const docRef = await addDoc(collection(db, 'urls'), newUrl);

    console.log('Documento añadido con ID:', docRef.id);

    // Importante: Añadir la URL recién creada al store para actualización dinámica
    // Creamos un objeto completo con id para añadirlo al store
    const newUrlWithId = {
      id: docRef.id,
      ...newUrl
    };

    // Añadimos al store en memoria para que se muestre sin recargar
    urlStore.urls.unshift(newUrlWithId);

    // Éxito
    successMsg.value = '¡URL añadida correctamente!';
    name.value = '';
    site_name.value = '';
    originalUrl.value = '';

    // Limpiar mensaje de éxito después de un tiempo
    setTimeout(() => {
      successMsg.value = '';
    }, 3000);

  } catch (error) {
    console.error('Error al añadir documento:', error);
    errorMsg.value = 'Error al guardar: ' + error.message;
  } finally {
    isSubmitting.value = false;
  }
};
// Función para manejar la actualización del tema
const handleThemeUpdated = () => {
  console.log('Tema actualizado correctamente');
  // Podríamos añadir lógica adicional si es necesario
};
</script>

<template>
  <div class=" shadow rounded-lg p-6 mb-8 bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-primary)] to-[var(--color-secondary)] ">
    <h2 class="text-xl font-semibold text-gray-800 mb-4 text-white ">Añadir nueva URL</h2>
    <form @submit.prevent="submitForm">

      <div class="mb-4">
        <label for="site_name" class="block text-sm font-medium text-gray-700 mb-1 text-white">Nombre del sitio</label>
        <input type="text" id="site_name" v-model="site_name" placeholder="Mi sitio web" required
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
      </div>
      <div class="mb-4">
        <label for="dev_name" class="block text-sm font-medium text-gray-700 mb-1 text-white">¿Quien la maqueto?</label>
        <input type="text" id="dev_name" v-model="name" placeholder="Nombre del desarrollador" required
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
      </div>


      <div class="mb-6">
        <label for="originalUrl" class="block text-sm font-medium text-gray-700 mb-1 text-white">URL</label>
        <input type="url" id="originalUrl" v-model="originalUrl" placeholder="https://ejemplo.com" required
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
      </div>

      <button type="submit" :disabled="isSubmitting"
        class=" w-full button-custom   text-white font-large py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed">
        <span class="text-lg font-bold uppercase " v-if="!isSubmitting">Añadir URL</span>
        <span v-else class="flex items-center justify-center">
          <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none"
            viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
            </path>
          </svg>
          Procesando...
        </span>
      </button>
    </form>

    <div v-if="errorMsg" class="mt-4 text-sm text-red-600 p-2 bg-red-50 rounded">
      {{ errorMsg }}
    </div>

    <div v-if="successMsg" class="mt-4 text-sm text-green-600 p-2 bg-green-50 rounded">
      {{ successMsg }}
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
</style>