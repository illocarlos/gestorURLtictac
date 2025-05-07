<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useUrlStore } from '../stores/url';
import ErrorRegistrationModal from './ErrorRegistrationModal.vue';
import ErrorInfoModal from './ErrorInfoModal.vue';
import VisitDetailsModal from './VisitDetailsModal.vue'; // Nuevo componente para detalles de visitas

const urlStore = useUrlStore();
const showInfoModal = ref(false);
const selectedUrlForInfo = ref(null);
const showVisitorDetails = ref(null); // Para controlar qué URL muestra los detalles de visitantes
const showVisitDetailsModal = ref(false); // Para mostrar el modal de detalles de visitas
const selectedUrlForVisits = ref(null); // URL seleccionada para mostrar visitas

onMounted(() => {
    loadUrls();
});

// Observar cambios en los errores para actualización automática
watch(() => urlStore.urls, () => {
    // Actualización automática cuando cambian las URLs
}, { deep: true });

const loadUrls = () => {
    urlStore.fetchUrls();
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

    // Convertir el objeto agrupado en un array para la iteración en el template
    return Object.entries(grouped).map(([domain, urls]) => ({
        domain,
        urls
    }));
});

const truncateUrl = (url) => {
    return url.length > 40 ? url.substring(0, 37) + '...' : url;
};

// Función modificada para recopilar información de visita
const visitUrl = async (url) => {
    try {
        // Recopilar información básica del visitante
        const visitorInfo = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            language: navigator.language,
            screenSize: `${window.screen.width}x${window.screen.height}`,
            platform: navigator.platform,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            referrer: document.referrer || 'Directo'
        };

        // Intentar obtener información geográfica aproximada basada en IP
        try {
            // Esto es opcional y depende de servicios externos
            const geoResponse = await fetch('https://ipapi.co/json/');
            const geoData = await geoResponse.json();

            // Solo añadir si la petición fue exitosa
            if (geoData && geoData.ip) {
                visitorInfo.ip = geoData.ip;
                visitorInfo.country = geoData.country_name;
                visitorInfo.city = geoData.city;
                visitorInfo.region = geoData.region;
            }
        } catch (error) {
            console.log('No se pudo obtener información geográfica');
        }

        // Mostrar mensaje de consentimiento
        if (confirm('Al visitar este enlace, aceptas que recopilemos información básica de tu visita para análisis. ¿Deseas continuar?')) {
            // Incrementar visitas con la información detallada
            await urlStore.incrementVisits(url.id, visitorInfo);

            // Abrir URL en nueva pestaña
            window.open(url.original, '_blank');
        }
    } catch (error) {
        console.error('Error al procesar visita:', error);
        // Aún así incrementar la visita básica si hay error
        urlStore.incrementVisits(url.id);
        window.open(url.original, '_blank');
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

// Función para mostrar/ocultar tooltip de detalles de visitantes
const toggleVisitorDetails = (urlId) => {
    if (showVisitorDetails.value === urlId) {
        showVisitorDetails.value = null; // Ocultar si ya está mostrando
    } else {
        showVisitorDetails.value = urlId; // Mostrar para esta URL
    }
};

// Nueva función para abrir el modal de detalles de visitas
const openVisitDetailsModal = (url) => {
    selectedUrlForVisits.value = url;
    showVisitDetailsModal.value = true;
};

// Función para cerrar el modal de detalles de visitas
const closeVisitDetailsModal = () => {
    showVisitDetailsModal.value = false;
    selectedUrlForVisits.value = null;
};

// Función para formatear fecha/hora
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

        <div v-if="urlStore.error" class="mb-4 text-sm text-red-600">
            {{ urlStore.error }}
        </div>

        <div class="overflow-x-auto" v-if="urlStore.urls.length > 0">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th scope="col"
                            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Dominio / Nombre</th>
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
                    <!-- Grupo de dominio -->
                    <template v-for="(group, groupIndex) in urlsGroupedByDomain" :key="'group-' + groupIndex">
                        <!-- Fila de dominio -->
                        <tr class="bg-gray-100">
                            <td colspan="5" class="px-6 py-2 text-sm font-bold text-gray-800">
                                {{ group.domain }}
                            </td>
                        </tr>

                        <!-- URLs dentro del grupo de dominio -->
                        <template v-for="url in group.urls" :key="url.id">
                            <tr
                                :class="{ 'bg-green-50': url.status === 'approved', 'bg-red-50': url.status === 'rejected' }">
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 pl-10">
                                    <!-- Indentación para mostrar jerarquía -->
                                    {{ url.name }}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm">
                                    <a :href="url.original" @click.prevent="visitUrl(url)"
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
                                    <!-- Número de visitas clickeable para ver detalles -->
                                    <span @click="openVisitDetailsModal(url)"
                                        class="font-medium text-indigo-600 hover:text-indigo-900 cursor-pointer hover:underline"
                                        :class="{ 'opacity-50 cursor-not-allowed': !url.visitDetails || url.visitDetails.length === 0 }"
                                        :title="url.visitDetails && url.visitDetails.length > 0 ? 'Haz clic para ver detalles de visitas' : 'No hay detalles de visitas disponibles'">
                                        {{ url.visits || 0 }}
                                    </span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div class="flex space-x-3">
                                        <!-- Botón de visita (ojo) con tooltip para detalles de visitantes -->
                                        <div class="relative">
                                            <button @click="visitUrl(url)" @mouseenter="toggleVisitorDetails(url.id)"
                                                @mouseleave="toggleVisitorDetails(null)"
                                                class="text-indigo-600 hover:text-indigo-900"
                                                title="Visitar / Ver detalles de visitantes">
                                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none"
                                                    viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path stroke-linecap="round" stroke-linejoin="round"
                                                        stroke-width="2"
                                                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            </button>

                                            <!-- Tooltip de visitantes -->
                                            <div v-if="showVisitorDetails === url.id && url.visitDetails && url.visitDetails.length > 0"
                                                class="absolute z-10 left-0 mt-2 w-96 px-2 py-2 bg-white rounded-lg shadow-xl border border-gray-200 text-xs">
                                                <h4 class="font-bold mb-1 text-gray-700">Últimas visitas:</h4>
                                                <div class="max-h-64 overflow-y-auto">
                                                    <div v-for="(visit, vIndex) in url.visitDetails.slice().reverse().slice(0, 10)"
                                                        :key="vIndex"
                                                        class="mb-2 pb-2 border-b border-gray-100 last:border-0">
                                                        <div class="text-xs text-gray-600">
                                                            <p class="font-semibold">{{ formatDateTime(visit.timestamp)
                                                                }}</p>
                                                            <p v-if="visit.city || visit.country">
                                                                Ubicación: {{ [visit.city, visit.region,
                                                                visit.country].filter(Boolean).join(', ') }}
                                                            </p>
                                                            <p v-if="visit.userAgent">
                                                                Navegador: {{ visit.userAgent.split(' ').slice(-1)[0] }}
                                                            </p>
                                                            <p v-if="visit.platform">
                                                                Plataforma: {{ visit.platform }}
                                                            </p>
                                                            <p v-if="visit.screenSize">
                                                                Pantalla: {{ visit.screenSize }}
                                                            </p>
                                                            <p v-if="visit.referrer">
                                                                Referencia: {{ visit.referrer }}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div v-if="url.visitDetails.length > 10"
                                                    class="text-center text-xs text-gray-500 mt-1">
                                                    Mostrando 10 de {{ url.visitDetails.length }} visitas
                                                </div>
                                            </div>
                                        </div>

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
                                        <!-- Botón de información -->
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
                        </template>
                    </template>
                </tbody>
            </table>
        </div>

        <div v-else-if="!urlStore.loading" class="py-6 text-center text-gray-500 italic">
            No hay URLs registradas. ¡Comienza añadiendo tu primera URL!
        </div>

        <!-- Componentes de Modal -->
        <ErrorRegistrationModal :is-open="urlStore.modalOpen" :error-messages="urlStore.errorMessages"
            @close="urlStore.closeModal" @add-error="addError" @remove-error="removeError"
            @submit-errors="submitErrors" />

        <ErrorInfoModal :is-open="showInfoModal" :url="selectedUrlForInfo" @close="closeInfoModal" />

        <!-- Modal de detalles de visitas -->
        <VisitDetailsModal :is-open="showVisitDetailsModal" :url="selectedUrlForVisits"
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
</style>