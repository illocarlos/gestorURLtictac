<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  isOpen: Boolean,
  url: Object
});

const emit = defineEmits(['close']);

// Para paginación de visitas
const currentPage = ref(1);
const visitsPerPage = ref(10);
const searchTerm = ref('');
const sortBy = ref('timestamp');
const sortDirection = ref('desc');

// Filtrar y ordenar las visitas
const filteredVisits = computed(() => {
  if (!props.url || !props.url.visitDetails) return [];
  
  let filtered = [...props.url.visitDetails];
  
  // Filtrar por término de búsqueda
  if (searchTerm.value) {
    const term = searchTerm.value.toLowerCase();
    filtered = filtered.filter(visit => {
      // Buscar en cualquier propiedad de texto del objeto de visita
      return Object.entries(visit).some(([key, value]) => {
        return typeof value === 'string' && value.toLowerCase().includes(term);
      });
    });
  }
  
  // Ordenar las visitas
  filtered.sort((a, b) => {
    let aValue = a[sortBy.value];
    let bValue = b[sortBy.value];
    
    // Manejar valores null o undefined
    if (aValue === undefined || aValue === null) aValue = '';
    if (bValue === undefined || bValue === null) bValue = '';
    
    // Comparar según tipo de dato
    let comparison = 0;
    if (typeof aValue === 'string') {
      comparison = aValue.localeCompare(bValue);
    } else {
      comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    }
    
    // Invertir si es descendente
    return sortDirection.value === 'desc' ? comparison * -1 : comparison;
  });
  
  return filtered;
});

// Paginación
const totalPages = computed(() => {
  return Math.ceil(filteredVisits.value.length / visitsPerPage.value);
});

const paginatedVisits = computed(() => {
  const start = (currentPage.value - 1) * visitsPerPage.value;
  const end = start + visitsPerPage.value;
  return filteredVisits.value.slice(start, end);
});

// Navegar entre páginas
const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
};

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};

// Cambiar ordenamiento
const changeSort = (field) => {
  if (sortBy.value === field) {
    // Si ya está ordenado por este campo, invertir dirección
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    // Nuevo campo, ordenar descendente por defecto
    sortBy.value = field;
    sortDirection.value = 'desc';
  }
};

// Formatear fecha/hora
const formatDateTime = (isoString) => {
  if (!isoString) return 'Fecha desconocida';
  
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  } catch (e) {
    return isoString;
  }
};

// Función para generar una URL de la bandera del país
const getCountryFlag = (countryName) => {
  // Mapa de nombres de países a códigos ISO
  const countryCodes = {
    'Spain': 'es',
    'España': 'es',
    'United States': 'us',
    'Estados Unidos': 'us',
    'United Kingdom': 'gb',
    'Reino Unido': 'gb',
    'France': 'fr',
    'Francia': 'fr',
    'Germany': 'de',
    'Alemania': 'de',
    // Añadir más países según sea necesario
  };
  
  if (!countryName) return null;
  
  const code = countryCodes[countryName] || null;
  if (!code) return null;
  
  return `https://flagcdn.com/16x12/${code.toLowerCase()}.png`;
};

// Detectar SO a partir del user agent
const detectOS = (userAgent) => {
  if (!userAgent) return 'Desconocido';
  
  if (userAgent.includes('Win')) return 'Windows';
  if (userAgent.includes('Mac')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
  
  return 'Otro';
};

// Detectar navegador a partir del user agent
const detectBrowser = (userAgent) => {
  if (!userAgent) return 'Desconocido';
  
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
  if (userAgent.includes('Edg')) return 'Edge';
  if (userAgent.includes('MSIE') || userAgent.includes('Trident')) return 'Internet Explorer';
  
  return 'Otro';
};

// Resetear filtros
const resetFilters = () => {
  searchTerm.value = '';
  sortBy.value = 'timestamp';
  sortDirection.value = 'desc';
  currentPage.value = 1;
};
</script>

<template>
  <div v-if="isOpen && url"
    class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
    <div class="relative mx-auto p-5 border w-full max-w-5xl shadow-lg rounded-md bg-white">
      <!-- Botón X para cerrar (arriba a la derecha) -->
      <button @click="emit('close')"
        class="absolute top-3 right-3 text-gray-400 hover:text-gray-600 focus:outline-none">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div class="mt-3">
        <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
          Detalles de visitas para: <span class="text-indigo-600">{{ url.name }}</span>
        </h3>
        
        <!-- Información básica de la URL -->
        <div class="bg-gray-50 rounded-md p-3 mb-4 text-sm">
          <p><span class="font-semibold">URL completa:</span> <a :href="url.original" target="_blank" class="text-indigo-600 hover:text-indigo-900">{{ url.original }}</a></p>
          <p><span class="font-semibold">Estado:</span> 
            <span v-if="url.status === 'pending'" class="text-yellow-600">Pendiente</span>
            <span v-else-if="url.status === 'approved'" class="text-green-600">Aprobada</span>
            <span v-else-if="url.status === 'rejected'" class="text-red-600">Rechazada</span>
          </p>
          <p><span class="font-semibold">Total de visitas:</span> {{ url.visits || 0 }}</p>
        </div>
        
        <!-- Filtros y búsqueda -->
        <div class="mb-4 flex flex-wrap items-center gap-4">
          <div class="flex-1 min-w-[200px]">
            <input 
              type="text" 
              v-model="searchTerm" 
              placeholder="Buscar en visitas..." 
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <div class="flex items-center gap-2">
            <label class="text-sm text-gray-600">Mostrar:</label>
            <select 
              v-model="visitsPerPage" 
              class="form-select rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
            >
              <option :value="5">5</option>
              <option :value="10">10</option>
              <option :value="25">25</option>
              <option :value="50">50</option>
            </select>
          </div>
          
          <button 
            @click="resetFilters" 
            class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-md text-sm"
          >
            Reiniciar filtros
          </button>
        </div>

        <!-- Tabla de visitas -->
        <div v-if="filteredVisits.length > 0" class="overflow-x-auto border rounded-lg">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th 
                  @click="changeSort('timestamp')" 
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Fecha/Hora
                  <span v-if="sortBy === 'timestamp'" class="ml-1">
                    {{ sortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th 
                  @click="changeSort('country')" 
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Ubicación
                  <span v-if="sortBy === 'country'" class="ml-1">
                    {{ sortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th 
                  @click="changeSort('userAgent')" 
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Dispositivo/Navegador
                  <span v-if="sortBy === 'userAgent'" class="ml-1">
                    {{ sortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
                <th 
                  @click="changeSort('referrer')" 
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  Referencia
                  <span v-if="sortBy === 'referrer'" class="ml-1">
                    {{ sortDirection === 'asc' ? '↑' : '↓' }}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="(visit, index) in paginatedVisits" :key="index" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ formatDateTime(visit.timestamp) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div class="flex items-center">
                    <img v-if="getCountryFlag(visit.country)" :src="getCountryFlag(visit.country)" class="mr-2" alt="Bandera país" />
                    <span>
                      {{ [visit.city, visit.region, visit.country].filter(Boolean).join(', ') || 'Desconocida' }}
                    </span>
                  </div>
                  <div v-if="visit.ip" class="text-xs text-gray-400 mt-1">
                    IP: {{ visit.ip }}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div>
                    <span class="font-medium">{{ detectOS(visit.userAgent) }}</span> / {{ detectBrowser(visit.userAgent) }}
                  </div>
                  <div class="text-xs text-gray-400 mt-1">
                    {{ visit.screenSize || 'Tamaño desconocido' }}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span class="truncate block max-w-xs" :title="visit.referrer">
                    {{ visit.referrer || 'Directo' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Mensaje si no hay visitas -->
        <div v-else-if="!url.visitDetails || url.visitDetails.length === 0" class="text-center py-8 text-gray-500 bg-gray-50 rounded-md">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="font-medium">No hay detalles de visitas disponibles</p>
          <p class="text-sm mt-1">El registro detallado de visitas se inició recientemente o no hay datos registrados aún.</p>
        </div>
        
        <!-- Mensaje si no hay resultados de búsqueda -->
        <div v-else class="text-center py-8 text-gray-500 bg-gray-50 rounded-md">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p class="font-medium">No se encontraron coincidencias</p>
          <p class="text-sm mt-1">Prueba con otros términos de búsqueda o restablece los filtros.</p>
        </div>
        
        <!-- Paginación -->
        <div v-if="filteredVisits.length > 0" class="flex justify-between items-center mt-4">
          <div class="text-sm text-gray-700">
            Mostrando {{ paginatedVisits.length }} de {{ filteredVisits.length }} visitas
          </div>
          <div class="flex space-x-2">
            <button 
              @click="prevPage" 
              :disabled="currentPage <= 1"
              class="px-3 py-1 bg-gray-100 text-gray-800 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span class="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-md">
              {{ currentPage }} / {{ totalPages || 1 }}
            </span>
            <button 
              @click="nextPage" 
              :disabled="currentPage >= totalPages"
              class="px-3 py-1 bg-gray-100 text-gray-800 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
        
        <!-- Botón para cerrar -->
        <div class="mt-6 text-right">
          <button 
            @click="emit('close')"
            class="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-select {
  padding: 0.375rem 2.25rem 0.375rem 0.75rem;
  font-size: 0.875rem;
  line-height: 1.5;
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 16px 12px;
  appearance: none;
}
</style>