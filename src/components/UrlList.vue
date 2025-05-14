<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useUrlStore } from '../stores/url';
import ErrorRegistrationModal from './ErrorRegistrationModal.vue';
import ErrorInfoModal from './ErrorInfoModal.vue';
import VisitorAuthComponent from './VisitDetailsModal.vue';
import VisitConsentModal from './VisitConsentModal.vue';
import VisitDetailsModal from './VisitDetailsModal.vue';

const urlStore = useUrlStore();
const showInfoModal = ref(false);
const showVisitConsentModal = ref(false);
const showVisitDetailsModal = ref(false);
const selectedUrlForInfo = ref(null);
const selectedUrlForVisit = ref(null);
const selectedUrlForDetails = ref(null);
const visitorAuthRef = ref(null);

// Nuevas variables para arrastrar y soltar
const draggedDomain = ref(null);
const draggedIndex = ref(null);
const domainGroups = ref([]);
const isDragging = ref(false);
const dropTargetIndex = ref(null);

onMounted(() => {
    loadUrls();
});

// Observar cambios en los errores para actualización automática
watch(() => urlStore.urls, () => {
    // Actualización automática cuando cambian las URLs
}, { deep: true });

const loadUrls = async () => {
    await urlStore.fetchUrls();
    // Inicializar grupos de dominios para arrastrar y soltar
    syncDomainGroups();
};

// Función para extraer el dominio de una URL
const extractDomain = (url) => {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        // En caso de URL inválida, devolver la URL original
        return url;
    }
};

// Función para sincronizar los grupos de dominios con el store
const syncDomainGroups = () => {
    domainGroups.value = [...urlStore.domainOrder];
};

// Computed property para agrupar URLs por dominio
const urlsGroupedByDomain = computed(() => {
    const grouped = {};

    // Primero, agrupar URLs por dominio
    urlStore.urls.forEach(url => {
        const domain = extractDomain(url.original);
        if (!grouped[domain]) {
            grouped[domain] = [];
        }
        grouped[domain].push(url);
    });

    // Obtener todos los dominios presentes
    const allDomains = Object.keys(grouped);
    
    // Si hay dominios que no están en el orden guardado, añadirlos al final
    const missingDomains = allDomains.filter(domain => !urlStore.domainOrder.includes(domain));
    
    // Crear el array final de grupos ordenados
    return [...urlStore.domainOrder, ...missingDomains]
        .filter(domain => allDomains.includes(domain)) // Solo incluir dominios que existen en las URLs
        .map(domain => ({
            domain,
            urls: grouped[domain] || []
        }));
});

// Funciones para arrastrar y soltar
const handleDragStart = (domain, index, event) => {
    isDragging.value = true;
    draggedDomain.value = domain;
    draggedIndex.value = index;
    
    // Añadir clase para estilo durante arrastre
    event.currentTarget.classList.add('domain-dragging');
    
    // Establecer datos para arrastrar
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', domain);
    
    // Hacer un timeout para asegurar que la clase se aplica
    setTimeout(() => {
        event.currentTarget.classList.add('opacity-50');
    }, 10);
};

const handleDragEnd = (event) => {
    isDragging.value = false;
    draggedDomain.value = null;
    draggedIndex.value = null;
    dropTargetIndex.value = null;
    
    // Quitar clases de estilo
    event.currentTarget.classList.remove('domain-dragging', 'opacity-50');
    
    // Quitar clases de todos los posibles objetivos
    document.querySelectorAll('.domain-drop-target').forEach(el => {
        el.classList.remove('domain-drop-target');
    });
};

const handleDragOver = (index, event) => {
    event.preventDefault();
    
    // Si es el mismo elemento, no hacer nada
    if (index === draggedIndex.value) {
        return;
    }
    
    // Marcar como posible objetivo
    dropTargetIndex.value = index;
    event.currentTarget.classList.add('domain-drop-target');
};

const handleDragLeave = (event) => {
    event.currentTarget.classList.remove('domain-drop-target');
};

const handleDrop = async (index, event) => {
    event.preventDefault();
    
    // Quitar clases de estilo
    event.currentTarget.classList.remove('domain-drop-target');
    
    // Si es el mismo elemento, no hacer nada
    if (index === draggedIndex.value) {
        return;
    }
    
    // Reordenar dominios
    const newOrder = [...urlStore.domainOrder];
    const movedDomain = newOrder.splice(draggedIndex.value, 1)[0];
    newOrder.splice(index, 0, movedDomain);
    
    // Guardar el nuevo orden en Firestore
    await urlStore.saveDomainOrder(newOrder);
    
    // Actualizar la UI
    syncDomainGroups();
};

const truncateUrl = (url) => {
    return url.length > 40 ? url.substring(0, 37) + '...' : url;
};

// Función para abrir el modal de consentimiento de visita
const openVisitConsentModal = (url) => {
    selectedUrlForVisit.value = url;
    showVisitConsentModal.value = true;
};

// Función para cerrar el modal de consentimiento
const closeVisitConsentModal = () => {
    showVisitConsentModal.value = false;
    selectedUrlForVisit.value = null;
};

// Nueva función para abrir el modal de detalles de visitas
const openVisitDetailsModal = (url) => {
    selectedUrlForDetails.value = url;
    showVisitDetailsModal.value = true;
};

// Función para cerrar el modal de detalles de visitas
const closeVisitDetailsModal = () => {
    showVisitDetailsModal.value = false;
    selectedUrlForDetails.value = null;
};

const handleVisitConfirmed = async (data) => {
    try {
        // Extraer la url y la información del visitante
        const { url, visitorInfo } = data;

        // Usar la función recordVisit del store con la información adicional
        await urlStore.recordVisit(url.id, visitorInfo);

    } catch (error) {
        console.error('Error al registrar la visita:', error);
    }
};

const approveUrl = async (id) => {
    await urlStore.approveUrl(id);
};

const openRejectModal = (id) => {
    urlStore.openModal(id);
};

// Función para mostrar los errores en un modal
const openInfoModal = (url) => {
    selectedUrlForInfo.value = url;
    showInfoModal.value = true;
};

const closeInfoModal = () => {
    showInfoModal.value = false;
    selectedUrlForInfo.value = null;
};

// Manejar la eliminación de un error desde el modal de información
const handleRemoveError = async ({ urlId, errorIndex }) => {
    await urlStore.removeErrorFromUrl(urlId, errorIndex);
    // Si se eliminó el último error, podríamos considerar cerrar el modal
    const url = urlStore.urls.find(u => u.id === urlId);
    if (url && (!url.errorMessages || url.errorMessages.length === 0)) {
        closeInfoModal();
    }
    // Opcional: recargar las URLs para asegurar datos actualizados
    loadUrls();
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
            minute: '2-digit'
        }).format(date);
    } catch (e) {
        return isoString;
    }
};

// Función modificada para añadir errores con imágenes
const addError = async (errorData) => {
    // Llamar al método del store que ahora maneja objetos completos
    await urlStore.addErrorMessage(errorData);
};

const removeError = (index) => {
    urlStore.removeErrorMessage(index);
};

const submitErrors = async () => {
    await urlStore.submitErrorMessages();
    // Cerrar modal automáticamente
    urlStore.closeModal();
    // Actualizar la lista después de enviar errores
    loadUrls();
};
</script>

<template>
    <div class="bg-white shadow rounded-lg p-6 bg-gradient-to-r from-pink-600 via-pink-700 to-purple-800">
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-semibold text-white">URLs registradas</h2>
            <button @click="loadUrls" :disabled="urlStore.loading"
                class="button-custom uppercase font-bold bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed">
                {{ urlStore.loading ? 'Cargando...' : 'Actualizar lista' }}
            </button>
        </div>

        <!-- Instrucciones de arrastrar y soltar -->
        <div class="bg-white/10 p-3 rounded-md mb-4 text-white text-sm flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            <p>Para reordenar dominios, arrástralos y suéltalos en la posición deseada. Los cambios se guardan automáticamente.</p>
        </div>

        <div v-if="urlStore.error" class="mb-4 text-sm text-red-600">
            {{ urlStore.error }}
        </div>

        <div class="overflow-x-auto" v-if="urlStore.urls.length > 0">
            <div class="min-w-full divide-y divide-gray-200">
                <!-- Dominios reordenables -->
                <div v-for="(group, groupIndex) in urlsGroupedByDomain" :key="'group-' + groupIndex"
                     class="domain-group mb-6 rounded-lg overflow-hidden shadow-lg transition-all duration-300"
                     :class="{'shadow-xl transform scale-101': draggedIndex === groupIndex}"
                     draggable="true"
                     @dragstart="handleDragStart(group.domain, groupIndex, $event)"
                     @dragend="handleDragEnd($event)"
                     @dragover="handleDragOver(groupIndex, $event)"
                     @dragleave="handleDragLeave($event)"
                     @drop="handleDrop(groupIndex, $event)">
                    
                    <!-- Cabecera de dominio con indicadores de arrastre -->
                    <div class="domain-header p-3 bg-gradient-to-r from-pink-600 via-pink-700 to-purple-800 text-white flex items-center cursor-move">
                        <div class="drag-handle mr-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
                            </svg>
                        </div>
                        <h3 class="text-lg font-bold uppercase flex-1">{{ group.domain }}</h3>
                        <span class="text-xs bg-white/20 px-2 py-1 rounded-full">
                            {{ group.urls.length }} URLs
                        </span>
                    </div>

                    <!-- Tabla de URLs para este dominio -->
                    <table class="min-w-full divide-y divide-gray-200 bg-white">
                        <thead class="bg-gray-50">
                            <tr>
                                <th scope="col"
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Nombre</th>
                                <th scope="col"
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL
                                </th>
                                <th scope="col"
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Estado</th>
                                <th scope="col"
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Visitas</th>
                                <th scope="col"
                                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Acciones</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <!-- URLs para este dominio -->
                            <tr v-for="url in group.urls" :key="url.id"
                                :class="{ 'bg-green-50': url.status === 'approved', 'bg-red-50': url.status === 'rejected' }">
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {{ url.name }}
                                    <div class="text-xs text-gray-500">{{ url.site_name }}</div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm">
                                    <a href="#" @click.prevent="openVisitConsentModal(url)"
                                        class="text-indigo-600 hover:text-indigo-900 truncate block max-w-xs">
                                        {{ truncateUrl(url.original) }}
                                    </a>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span v-if="url.status === 'pending'"
                                        class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                        Pendiente
                                    </span>
                                    <span v-else-if="url.status === 'approved'"
                                        class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                        Aprobada
                                    </span>
                                    <span v-else-if="url.status === 'rejected'"
                                        class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                        Rechazada
                                    </span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <!-- Número de visitas clickeable para ver detalles completos -->
                                    <span @click="openVisitDetailsModal(url)"
                                        class="font-medium text-indigo-600 hover:text-indigo-900 cursor-pointer hover:underline">
                                        {{ url.visits || 0 }}
                                    </span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div class="flex space-x-3">
                                        <!-- Botón del ojo - Modificado para abrir el modal de consentimiento -->
                                        <button @click="openVisitConsentModal(url)"
                                            class="text-indigo-600 hover:text-indigo-900" title="Visitar URL">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none"
                                                viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        </button>
                                        <button @click="approveUrl(url.id)" class="text-green-600 hover:text-green-900"
                                            title="Aprobar" :disabled="url.status === 'approved'">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none"
                                                viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                    d="M5 13l4 4L19 7" />
                                            </svg>
                                        </button>
                                        <button @click="openRejectModal(url.id)" class="text-red-600 hover:text-red-900"
                                            title="Rechazar">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none"
                                                viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                    d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                        <!-- Botón de información de errores -->
                                        <button v-if="url.errorMessages && url.errorMessages.length > 0"
                                            @click="openInfoModal(url)" class="text-blue-600 hover:text-blue-900"
                                            title="Ver errores">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none"
                                                viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div v-else-if="!urlStore.loading" class="py-6 text-center text-gray-500 italic">
            No hay URLs registradas. ¡Comienza añadiendo tu primera URL!
        </div>

        <!-- Componentes de Modal -->
        <ErrorRegistrationModal :is-open="urlStore.modalOpen" :error-messages="urlStore.errorMessages"
            @close="urlStore.closeModal" @add-error="addError" @remove-error="removeError"
            @submit-errors="submitErrors" />

        <!-- Modal para ver errores - Modificado para incluir el handler de eliminación -->
        <ErrorInfoModal :is-open="showInfoModal" :url="selectedUrlForInfo" 
            @close="closeInfoModal" 
            @remove-error="handleRemoveError" />

        <!-- Modal de consentimiento para visitar URLs -->
        <VisitConsentModal :is-open="showVisitConsentModal" :url="selectedUrlForVisit" @close="closeVisitConsentModal"
            @visit-confirmed="handleVisitConfirmed" />

        <!-- Nuevo modal para detalles completos de visitas -->
        <VisitDetailsModal :is-open="showVisitDetailsModal" :url="selectedUrlForDetails"
            @close="closeVisitDetailsModal" />
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

/* Estilos para arrastrar y soltar */
.domain-group {
    transition: all 0.3s ease;
}

.domain-dragging {
    cursor: grabbing;
    z-index: 10;
}

.domain-drop-target {
    border: 2px dashed #BBF33A;
    position: relative;
}

.domain-drop-target::before {
    content: '';
    position: absolute;
    top: -8px;
    left: 0;
    right: 0;
    height: 8px;
    background-color: #BBF33A;
    transform: scaleX(0.97);
    border-radius: 4px 4px 0 0;
    z-index: 5;
}

.drag-handle {
    cursor: move;
}

/* Ayuda al efecto de escala ligera durante el arrastre */
.scale-101 {
    transform: scale(1.01);
}
</style>