<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useUrlStore } from '../stores/url';
import ErrorRegistrationModal from './ErrorRegistrationModal.vue';
import ErrorInfoModal from './ErrorInfoModal.vue';
import VisitorAuthComponent from './VisitDetailsModal.vue';
import VisitConsentModal from './VisitConsentModal.vue';
import VisitDetailsModal from './VisitDetailsModal.vue';
import { db } from '../config/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useThemeStore } from '../stores/theme'; // Importar el store de temas

const urlStore = useUrlStore();
const showInfoModal = ref(false);
const showVisitConsentModal = ref(false);
const showVisitDetailsModal = ref(false);
const selectedUrlForInfo = ref(null);
const selectedUrlForVisit = ref(null);
const selectedUrlForDetails = ref(null);
const visitorAuthRef = ref(null);
const themeStore = useThemeStore(); // Inicializar el store de temas
const expandedDomains = ref({});

// Variables para el drag and drop - versión mejorada
const draggedDomain = ref(null);
const draggedIndex = ref(null);
const isDragging = ref(false);
const dropTargetIndex = ref(null);

// Variables para soporte táctil
const touchStartY = ref(0);
const touchStartX = ref(0);
const touchStartDomainIndex = ref(null);
const isTouchDragging = ref(false);
const touchTargetEl = ref(null);
const touchMovedDistance = ref(0);
const isMobileDevice = ref(false);

onMounted(() => {
    loadUrls();
    // Detectar si es un dispositivo móvil
    isMobileDevice.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Añadir listener global para eventos táctiles
    if (isMobileDevice.value) {
        document.addEventListener('touchend', handleGlobalTouchEnd);
        document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    }
});

// Limpiar listeners al desmontar
const onBeforeUnmount = () => {
    if (isMobileDevice.value) {
        document.removeEventListener('touchend', handleGlobalTouchEnd);
        document.removeEventListener('touchmove', handleGlobalTouchMove);
    }
};

// Observar cambios en los errores para actualización automática
watch(() => urlStore.urls, () => {
    // Actualización automática cuando cambian las URLs
}, { deep: true });

const loadUrls = async () => {
    console.log('⚠️ loadUrls called');
    await urlStore.fetchUrls();
    // Inicializar grupos de dominios para arrastrar y soltar
    console.log('⚠️ URLs loaded, domain order:', urlStore.domainOrder);
    syncDomainGroups();
    console.log('⚠️ Domain groups synced:', domainGroups.value);
    
    // Initialize all domains as expanded by default
    urlStore.domainOrder.forEach(domain => {
        expandedDomains.value[domain] = true;
    });
};

// Función para sincronizar forzadamente el orden de dominios
const forceSync = async () => {
    try {
        // Obtener el orden actual desde Firestore
        const orderDoc = await getDoc(doc(db, 'settings', 'domainOrder'));
        if (orderDoc.exists()) {
            const orderData = orderDoc.data();
            if (orderData.order && Array.isArray(orderData.order)) {
                urlStore.domainOrder = [...orderData.order];
                
                // Actualizar la UI
                await urlStore.fetchUrls();
                
                alert('Orden de dominios sincronizado correctamente');
            }
        }
    } catch (error) {
        console.error('Error al sincronizar orden:', error);
        alert('Error al sincronizar el orden. Por favor, intenta de nuevo.');
    }
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

// Toggle domain expansion
const toggleDomain = (domain) => {
    expandedDomains.value[domain] = !expandedDomains.value[domain];
};

// Dominio grupos 
const domainGroups = ref([]);

// Función para sincronizar los grupos de dominios con el store
const syncDomainGroups = () => {
    console.log('⚠️ Syncing domain groups');
    console.log('⚠️ urlStore.domainOrder:', urlStore.domainOrder);
    
    // Asegurarse de que domainOrder tiene un valor válido
    if (urlStore.domainOrder && Array.isArray(urlStore.domainOrder)) {
        const filteredDomains = urlStore.domainOrder.filter(d => d);
        console.log('⚠️ Filtered domains:', filteredDomains);
        domainGroups.value = [...filteredDomains]; 
    } else {
        console.warn('⚠️ WARNING: urlStore.domainOrder is invalid, using empty array');
        domainGroups.value = []; // Inicializar como un array vacío si no hay datos
    }
    
    console.log('⚠️ Updated domainGroups.value:', domainGroups.value);
};

// Actualizar el computed property urlsGroupedByDomain
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
    
    // Si se han encontrado dominios que faltan, actualizamos el domainOrder
    if (missingDomains.length > 0) {
        console.log('⚠️ Found missing domains:', missingDomains);
        // Actualizamos el domainOrder en el store
        setTimeout(async () => {
            const newOrder = [...urlStore.domainOrder, ...missingDomains];
            console.log('⚠️ Updating domain order with missing domains:', newOrder);
            await urlStore.saveDomainOrder(newOrder);
            console.log('⚠️ Domain order updated with missing domains');
        }, 0);
    }
    
    // Crear el array final de grupos ordenados
    return [...urlStore.domainOrder, ...missingDomains]
        .filter(domain => allDomains.includes(domain)) // Solo incluir dominios que existen en las URLs
        .map(domain => ({
            domain,
            urls: grouped[domain] || []
        }));
});

// EVENTOS TÁCTILES PARA MÓVILES
// ----------------------------

// Iniciar arrastre táctil
const handleTouchStart = (domain, index, event) => {
    // Solo procesar si es el header del dominio
    if (!event.target.closest('.domain-header')) return;
    
    // Evitar procesamiento si ya hay un arrastre en curso
    if (isTouchDragging.value) return;
    
    // Guardar la posición inicial
    const touch = event.touches[0];
    touchStartY.value = touch.clientY;
    touchStartX.value = touch.clientX;
    touchStartDomainIndex.value = index;
    touchTargetEl.value = event.currentTarget;
    touchMovedDistance.value = 0;
    
    // Marcar como potencial arrastre (aún no confirmado)
    setTimeout(() => {
        // Si después de 100ms no ha habido movimiento significativo, no es un arrastre
        if (touchStartDomainIndex.value === index && touchMovedDistance.value < 10) {
            // Probablemente es un tap/click, no un arrastre
            touchStartDomainIndex.value = null;
        }
    }, 100);
};

// Procesar movimiento táctil global
const handleGlobalTouchMove = (event) => {
    // Si no hay arrastre táctil iniciado, ignorar
    if (touchStartDomainIndex.value === null) return;
    
    const touch = event.touches[0];
    const deltaY = touch.clientY - touchStartY.value;
    const deltaX = touch.clientX - touchStartX.value;
    
    // Calcular la distancia total movida
    touchMovedDistance.value = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Si el movimiento es suficiente, iniciar arrastre
    if (touchMovedDistance.value > 15 && !isTouchDragging.value) {
        // Marcar como arrastre confirmado
        isTouchDragging.value = true;
        draggedDomain.value = urlsGroupedByDomain.value[touchStartDomainIndex.value].domain;
        draggedIndex.value = touchStartDomainIndex.value;
        
        // Aplicar efectos visuales
        if (touchTargetEl.value) {
            touchTargetEl.value.classList.add('touch-dragging');
        }
        
        // Prevenir scroll durante el arrastre
        event.preventDefault();
    }
    
    // Si ya estamos arrastrando, actualizar la posición visual y encontrar posible objetivo
    if (isTouchDragging.value) {
        // Prevenir scroll
        event.preventDefault();
        
        if (touchTargetEl.value) {
            // Mover el elemento visualmente con transform
            touchTargetEl.value.style.transform = `translateY(${deltaY}px)`;
            
            // Encontrar el elemento objetivo basado en la posición actual
            updateDropTargetFromTouchPosition(touch.clientY);
        }
    }
};

// Encontrar el posible objetivo del drop basado en la posición del touch
const updateDropTargetFromTouchPosition = (clientY) => {
    // Resetear el objetivo anterior
    dropTargetIndex.value = null;
    
    // Obtener todos los elementos de dominio
    const domainElements = document.querySelectorAll('.domain-group');
    
    // Para cada elemento, comprobar si el toque está sobre él
    domainElements.forEach((el, index) => {
        // Ignorar el elemento que se está arrastrando
        if (index === draggedIndex.value) return;
        
        const rect = el.getBoundingClientRect();
        
        // Si el toque está sobre este elemento, marcarlo como objetivo
        if (clientY >= rect.top && clientY <= rect.bottom) {
            dropTargetIndex.value = index;
        }
    });
};

// Finalizar arrastre táctil
const handleGlobalTouchEnd = async (event) => {
    // Si no hay arrastre táctil en curso, ignorar
    if (!isTouchDragging.value) {
        touchStartDomainIndex.value = null;
        return;
    }
    
    // Limpiar efectos visuales
    if (touchTargetEl.value) {
        touchTargetEl.value.classList.remove('touch-dragging');
        touchTargetEl.value.style.transform = '';
    }
    
    // Si tenemos un objetivo de drop, procesar el cambio de orden
    if (dropTargetIndex.value !== null && dropTargetIndex.value !== draggedIndex.value) {
        await processDomainReorder(draggedIndex.value, dropTargetIndex.value);
    }
    
    // Resetear todas las variables
    isTouchDragging.value = false;
    draggedDomain.value = null;
    draggedIndex.value = null;
    dropTargetIndex.value = null;
    touchStartDomainIndex.value = null;
    touchTargetEl.value = null;
};

// EVENTOS DE MOUSE PARA ESCRITORIO
// ------------------------------

// Funciones de drag and drop mejoradas
const handleDragStart = (domain, index, event) => {
    // En dispositivos táctiles, delegar a los eventos táctiles
    if (isMobileDevice.value) {
        event.preventDefault();
        return;
    }
    
    console.log(`Iniciando arrastre del dominio: ${domain} desde el índice: ${index}`);
    
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', domain);
    
    // Guardar lo que estamos arrastrando
    draggedDomain.value = domain;
    draggedIndex.value = index;
    isDragging.value = true;
};

const handleDragOver = (index, event) => {
    event.preventDefault();
    
    // No hacer nada si es el mismo elemento
    if (index === draggedIndex.value) {
        dropTargetIndex.value = null;
        return;
    }
    
    // Marcar el objetivo actual
    dropTargetIndex.value = index;
};

const handleDragEnd = () => {
    console.log('Arrastre terminado');
    isDragging.value = false;
    draggedDomain.value = null;
    draggedIndex.value = null;
    dropTargetIndex.value = null;
};

// Función handleDrop mejorada
const handleDrop = async (index, event) => {
    event.preventDefault();
    
    console.log(`Soltando en índice: ${index}`);
    
    // Resetear el indicador visual
    dropTargetIndex.value = null;
    
    // Validaciones básicas
    if (!draggedDomain.value || index === draggedIndex.value || index === null) {
        console.log('Drop cancelado: condiciones no válidas');
        return;
    }
    
    // Procesar el reordenamiento
    await processDomainReorder(draggedIndex.value, index);
    
    // Resetear el estado de arrastre
    isDragging.value = false;
    draggedDomain.value = null;
    draggedIndex.value = null;
};

// Función para procesar el reordenamiento (usado tanto por mouse como por touch)
const processDomainReorder = async (sourceIndex, targetIndex) => {
    try {
        // 1. Obtener el orden actual de dominios
        const currentOrderCopy = [...urlStore.domainOrder];
        console.log('Orden actual:', currentOrderCopy);
        
        // 2. Obtener el dominio en la posición de origen
        const domainToMove = currentOrderCopy[sourceIndex];
        
        // 3. Eliminar el dominio de su posición actual
        currentOrderCopy.splice(sourceIndex, 1);
        
        // 4. Insertar el dominio en la nueva posición
        currentOrderCopy.splice(targetIndex, 0, domainToMove);
        
        console.log('Nuevo orden:', currentOrderCopy);
        
        // 5. Guardar el nuevo orden en Firestore
        await urlStore.saveDomainOrder(currentOrderCopy);
        
        console.log('Orden guardado en Firestore y actualizado en el store');
        
        // 6. Para asegurar la sincronización inmediata, forzar la actualización de la UI
        await urlStore.fetchUrls();
        
        return true;
    } catch (error) {
        console.error('ERROR al actualizar el orden:', error);
        alert('Error al actualizar el orden de dominios. Por favor, intenta de nuevo.');
        return false;
    }
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
    <div class="bg-white shadow rounded-lg p-4 sm:p-6 bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-primary)] to-[var(--color-secondary)] ">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-4">
            <h2 class="text-xl font-semibold text-white">URLs registradas</h2>
            <div class="flex flex-wrap gap-2">
                <button @click="loadUrls" :disabled="urlStore.loading"
                :style="{ backgroundColor: themeStore.accentColor, color: themeStore.textColor }"
                    class="button-custom uppercase font-bold bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed w-full sm:w-auto">
                    {{ urlStore.loading ? 'Cargando...' : 'Actualizar lista' }}
                </button>
            </div>
        </div>

        <!-- Instrucciones específicas para móvil vs escritorio -->
        <div class="bg-white/10 p-3 rounded-md mb-4 text-white text-sm">
            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                <p v-if="isMobileDevice">
                    Para reordenar dominios, mantén presionado un grupo y arrástralo a la posición deseada.
                </p>
                <p v-else>
                    Para reordenar dominios, arrástralos y suéltalos en la posición deseada. Los cambios se guardan automáticamente.
                </p>
            </div>
        </div>

        <div v-if="urlStore.error" class="mb-4 text-sm text-red-600 bg-red-100 p-3 rounded-md">
            {{ urlStore.error }}
        </div>

        <div v-if="urlStore.urls.length > 0" class="space-y-4">
            <!-- Dominios reordenables con soporte táctil -->
            <div v-for="(group, groupIndex) in urlsGroupedByDomain" :key="'group-' + groupIndex"
                 class="domain-group rounded-lg overflow-hidden shadow-lg transition-all duration-300"
                 :class="{
                   'shadow-xl transform scale-102': draggedIndex === groupIndex,
                   'opacity-50': isDragging && draggedIndex === groupIndex,
                   'border-4 border-lime-400': dropTargetIndex === groupIndex && draggedIndex !== groupIndex
                 }"
                 draggable="true"
                 @dragstart="handleDragStart(group.domain, groupIndex, $event)"
                 @dragend="handleDragEnd($event)"
                 @dragover="handleDragOver(groupIndex, $event)"
                 @dragleave="() => {}"
                 @drop="handleDrop(groupIndex, $event)"
                 @touchstart="handleTouchStart(group.domain, groupIndex, $event)">
                
                <!-- Indicador visual cuando es el objetivo del drop -->
                <div 
                    v-if="dropTargetIndex === groupIndex && draggedIndex !== groupIndex" 
                    class="bg-lime-400 text-black text-xs px-2 py-1 absolute right-0 top-0 rounded-bl-md z-10 font-bold animate-pulse">
                    Soltar aquí
                </div>
                
                <!-- Cabecera de dominio con indicadores y toggle -->
                <div class="domain-header p-3 bg-gradient-to-r from-[var(--color-primary-2)] via-[var(--color-primary-2)] to-[var(--color-secondary-2)]  flex items-center">
                    <div class="drag-handle mr-2 flex-shrink-0 touch-drag-handle">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
                        </svg>
                    </div>
                    <h3 class="text-md sm:text-lg font-bold uppercase flex-1 truncate">{{ group.domain }}</h3>
                    <div class="flex items-center gap-2">
                        <span class="text-xs bg-white/20 px-2 py-1 rounded-full">
                            {{ group.urls.length }} URLs
                        </span>
                        <button @click.stop="toggleDomain(group.domain)" class="p-1 hover:bg-white/20 rounded">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path v-if="expandedDomains[group.domain]" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Tabla de URLs para este dominio - Solo visible si está expandido -->
                <div v-if="expandedDomains[group.domain]" class="overflow-x-auto w-full">
                    <table class="min-w-full divide-y divide-gray-200 bg-white">
                        <thead class="bg-gray-50">
                            <tr>
                                <th scope="col"
                                    class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Nombre</th>
                                <th scope="col"
                                    class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL
                                </th>
                                <th scope="col"
                                    class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Estado</th>
                                <th scope="col"
                                    class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Visitas</th>
                                <th scope="col"
                                    class="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Acciones</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <!-- URLs para este dominio -->
                            <tr v-for="url in group.urls" :key="url.id"
                                :class="{ 'bg-green-50': url.status === 'approved', 'bg-red-50': url.status === 'rejected' }">
                                <td class="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                                    <span class="font-medium truncate block max-w-[100px] sm:max-w-[200px]">{{ url.name }}</span>
                                    <div class="text-xs text-gray-500 truncate max-w-[100px] sm:max-w-[200px]">{{ url.site_name }}</div>
                                </td>
                                <td class="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                                    <a href="#" @click.prevent="openVisitConsentModal(url)"
                                        class="text-indigo-600 hover:text-indigo-900 truncate block max-w-[80px] sm:max-w-[150px] md:max-w-[200px]">
                                        {{ truncateUrl(url.original) }}
                                    </a>
                                </td>
                                <td class="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap">
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
                                <td class="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                    <!-- Número de visitas clickeable para ver detalles completos -->
                                    <span @click="openVisitDetailsModal(url)"
                                        class="font-medium text-indigo-600 hover:text-indigo-900 cursor-pointer hover:underline">
                                        {{ url.visits || 0 }}
                                    </span>
                                </td>
                                <td class="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium">
                                    <div class="flex space-x-2">
                                        <!-- Botones de acción más grandes para táctil en móvil -->
                                        <button @click="openVisitConsentModal(url)"
                                            class="text-indigo-600 hover:text-indigo-900 p-1 touch-action-button" title="Visitar URL">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5" fill="none"viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        </button>
                                        <button @click="approveUrl(url.id)" class="text-green-600 hover:text-green-900 p-1 touch-action-button"
                                            title="Aprobar" :disabled="url.status === 'approved'">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5" fill="none"
                                                viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                    d="M5 13l4 4L19 7" />
                                            </svg>
                                        </button>
                                        <button @click="openRejectModal(url.id)" class="text-red-600 hover:text-red-900 p-1 touch-action-button"
                                            title="Rechazar">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5" fill="none"
                                                viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                    d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                        <!-- Botón de información de errores -->
                                        <button v-if="url.errorMessages && url.errorMessages.length > 0"
                                            @click="openInfoModal(url)" class="text-blue-600 hover:text-blue-900 p-1 touch-action-button"
                                            title="Ver errores">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 sm:h-5 sm:w-5" fill="none"
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
                
                <!-- Vista colapsada para móviles - muestra solo contador -->
                <div v-else class="bg-white p-3 text-center text-gray-500 text-sm">
                    <span class="italic">Grupo colapsado - Click para expandir</span>
                </div>
            </div>
        </div>

        <div v-else-if="!urlStore.loading" class="py-6 text-center text-white text-opacity-80 italic">
            No hay URLs registradas. ¡Comienza añadiendo tu primera URL!
        </div>
        
        <!-- Indicador de carga -->
        <div v-if="urlStore.loading" class="py-6 text-center text-white">
            <svg class="animate-spin h-8 w-8 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="mt-2">Cargando...</p>
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
    position: relative;
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
.scale-102 {
    transform: scale(1.02);
}

/* Animación de pulso para el indicador de soltar */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
.animate-pulse {
  animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Estilos para arrastre táctil */
.touch-dragging {
    opacity: 0.8;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    z-index: 50;
    position: relative;
}

.touch-drag-handle {
    padding: 8px;
    margin: -8px;
    cursor: grab;
}

.touch-action-button {
    min-height: 36px;
    min-width: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    transition: background-color 0.2s;
}

.touch-action-button:active {
    background-color: rgba(255, 255, 255, 0.2);
}

/* Estilos adicionales para responsividad */
@media (max-width: 640px) {
  .domain-header {
    padding: 0.5rem;
  }

  .domain-header h3 {
    font-size: 0.9rem;
  }

  .drag-handle svg {
    width: 16px;
    height: 16px;
  }

  /* Mejorar visualización de tablas en móvil */
  table {
    font-size: 0.75rem;
  }

  thead th {
    padding: 0.5rem 0.25rem;
  }

  tbody td {
    padding: 0.5rem 0.25rem;
  }

  /* Botones más grandes para facilitar toque en móvil */
  td button svg {
    width: 1rem;
    height: 1rem;
  }

  /* Mejorar visualización de estados */
  td span.rounded-full {
    padding: 0.125rem 0.5rem;
    font-size: 0.65rem;
  }
  
  /* Indicación visual de arrastre para móviles */
  .domain-header::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: linear-gradient(rgba(255, 255, 255, 0.05), transparent);
    pointer-events: none;
  }
}

/* Estilos para tablets */
@media (min-width: 641px) and (max-width: 1023px) {
  /* Ajustes para tablets */
  .domain-header {
    padding: 0.75rem;
  }

  table {
    font-size: 0.85rem;
  }
  
  /* Ajustar área de arrastre para tablets */
  .touch-drag-handle {
    padding: 10px;
    margin: -10px;
  }
}

/* Transiciones para expansión/colapso */
.domain-group {
  transition: max-height 0.3s ease-in-out, opacity 0.3s ease-in-out;
}

/* Mejora visual para hover en filas */
tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

/* Mejorar visualización del texto truncado */
.truncate {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Estilos para la tabla scrollable horizontal */
.overflow-x-auto {
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}

/* Estilizar scrollbar */
.overflow-x-auto::-webkit-scrollbar {
  height: 6px;
}

.overflow-x-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* Mejorar visualización en dispositivos pequeños */
@media (max-width: 480px) {
  .domain-group {
    margin-bottom: 1rem;
  }
  
  /* Hacer que algunos elementos sean más compactos */
  td:nth-child(2), th:nth-child(2) {
    max-width: 80px;
  }
  
  td:nth-child(3), th:nth-child(3) {
    max-width: 70px;
  }
  
  /* Reducir espacio entre botones de acción */
  td .flex.space-x-2 {
    column-gap: 4px !important;
  }
  
  /* Hacer los botones más grandes (área táctil) pero con iconos más pequeños */
  td button {
    padding: 4px;
  }
  
  /* Optimizar visualización de información de URLs */
  .truncate.max-w-\[80px\] {
    max-width: 60px !important;
  }
  
  /* Feedback visual para arrastre táctil */
  .domain-header {
    position: relative;
  }
  
  .domain-header::before {
    content: 'Mantén presionado para mover';
    position: absolute;
    bottom: -20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    opacity: 0;
    transition: opacity 0.3s;
    pointer-events: none;
    z-index: 10;
    white-space: nowrap;
  }
  
  .domain-header:active::before {
    opacity: 1;
  }
}
</style>