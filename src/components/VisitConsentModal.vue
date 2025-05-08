<script setup>
import { ref, computed, onMounted, watch } from 'vue';

const props = defineProps({
    isOpen: {
        type: Boolean,
        default: false
    },
    url: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['close', 'visit-confirmed']);

// Estado interno
const loading = ref(false);
const hasAccepted = ref(false);
const browserInfo = ref({});
const locationInfo = ref({
    ip: null,
    country: null,
    region: null,
    city: null
});

// Función para limpiar valores undefined (reemplazarlos por null)
const cleanUndefined = (obj) => {
    if (obj === undefined) return null;
    if (obj === null) return null;

    // Para arrays
    if (Array.isArray(obj)) {
        return obj.map(item => cleanUndefined(item));
    }

    // Para objetos
    if (typeof obj === 'object') {
        const result = {};
        for (const key in obj) {
            result[key] = cleanUndefined(obj[key]);
        }
        return result;
    }

    // Para valores primitivos
    return obj;
};

// Recopilar toda la información posible del navegador (sin mostrarla en la UI)
const collectBrowserInfo = () => {
    const info = {
        // Información básica del navegador
        userAgent: navigator.userAgent || null,
        appName: navigator.appName || null,
        appVersion: navigator.appVersion || null,
        platform: navigator.platform || null,
        vendor: navigator.vendor || null,
        language: navigator.language || null,
        languages: navigator.languages ? [...navigator.languages] : null,
        cookieEnabled: navigator.cookieEnabled || false,
        doNotTrack: navigator.doNotTrack || null,

        // Información de la pantalla
        screenWidth: window.screen.width || null,
        screenHeight: window.screen.height || null,
        screenAvailWidth: window.screen.availWidth || null,
        screenAvailHeight: window.screen.availHeight || null,
        screenColorDepth: window.screen.colorDepth || null,
        screenPixelDepth: window.screen.pixelDepth || null,
        devicePixelRatio: window.devicePixelRatio || null,

        // Información de la ventana
        innerWidth: window.innerWidth || null,
        innerHeight: window.innerHeight || null,
        outerWidth: window.outerWidth || null,
        outerHeight: window.outerHeight || null,

        // Información de la ubicación
        pageUrl: window.location.href || null,
        pageProtocol: window.location.protocol || null,
        pageHost: window.location.host || null,
        pagePath: window.location.pathname || null,

        // Información de red
        connectionType: navigator.connection ? (navigator.connection.effectiveType || null) : null,
        downlink: navigator.connection ? (navigator.connection.downlink || null) : null,

        // Hardware
        hardwareConcurrency: navigator.hardwareConcurrency || null,
        maxTouchPoints: navigator.maxTouchPoints || null,
        deviceMemory: navigator.deviceMemory || null,

        // Información de tiempo
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
        timezoneOffset: new Date().getTimezoneOffset() || null,

        // Referrer
        referrer: document.referrer || null,

        // Plugins del navegador
        plugins: [],

        // Historial de navegación (número de entradas)
        historyLength: window.history.length || null,

        // Información sobre el rendimiento
        loadTime: window.performance ? (window.performance.timing.loadEventEnd - window.performance.timing.navigationStart || null) : null,

        // Información sobre almacenamiento
        localStorage: !!window.localStorage,
        sessionStorage: !!window.sessionStorage,

        // Fecha y hora de la visita
        visitTimestamp: new Date().toISOString(),
    };

    // Recopilar información sobre plugins (garantizando que no haya valores undefined)
    if (navigator.plugins && navigator.plugins.length > 0) {
        for (let i = 0; i < navigator.plugins.length; i++) {
            const plugin = navigator.plugins[i];
            if (plugin) {
                info.plugins.push({
                    name: plugin.name || null,
                    description: plugin.description || null,
                    filename: plugin.filename || null,
                });
            }
        }
    }

    // Intentar obtener información de la batería
    if (navigator.getBattery) {
        navigator.getBattery().then(battery => {
            const batteryData = {
                level: battery.level !== undefined ? battery.level : null,
                charging: battery.charging !== undefined ? battery.charging : null,
                chargingTime: battery.chargingTime !== undefined ? (battery.chargingTime === Infinity ? null : battery.chargingTime) : null,
                dischargingTime: battery.dischargingTime !== undefined ? (battery.dischargingTime === Infinity ? null : battery.dischargingTime) : null
            };

            info.battery = batteryData;

            // Actualizar el objeto browserInfo
            browserInfo.value = { ...info };

            // Log para ver toda la información recopilada
            console.log('Información completa del navegador y dispositivo:', browserInfo.value);
        }).catch(err => {
            info.battery = null;
            browserInfo.value = { ...info };
            console.log('Información completa del navegador y dispositivo:', browserInfo.value);
        });
    } else {
        info.battery = null;
        browserInfo.value = { ...info };
        console.log('Información completa del navegador y dispositivo:', browserInfo.value);
    }

    return info;
};

// Obtener información de la ubicación e IP utilizando múltiples servicios para mayor precisión
const getLocationInfo = async () => {
    try {
        // Intentar primero con ipinfo.io (tiene un límite de 50,000 peticiones por mes)
        try {
            const response = await fetch('https://ipinfo.io/json');
            const data = await response.json();

            if (data && data.ip) {
                let loc = data.loc ? data.loc.split(',') : [null, null];

                locationInfo.value = {
                    ip: data.ip || null,
                    country: data.country ? data.country : null,
                    region: data.region || null,
                    city: data.city || null,
                    latitude: loc[0] || null,
                    longitude: loc[1] || null,
                    timezone: data.timezone || null,
                    isp: data.org || null
                };

                console.log('Información de ubicación obtenida de ipinfo.io:', locationInfo.value);
                return;
            }
        } catch (error) {
            console.warn('Error con ipinfo.io, intentando con otro servicio:', error);
        }

        // Intentar con ip-api.com como respaldo (10,000 peticiones por hora)
        try {
            const response = await fetch('http://ip-api.com/json?fields=status,message,country,regionName,city,lat,lon,timezone,isp,query');
            const data = await response.json();

            if (data && data.status === 'success') {
                locationInfo.value = {
                    ip: data.query || null,
                    country: data.country || null,
                    region: data.regionName || null,
                    city: data.city || null,
                    latitude: data.lat || null,
                    longitude: data.lon || null,
                    timezone: data.timezone || null,
                    isp: data.isp || null
                };

                console.log('Información de ubicación obtenida de ip-api.com:', locationInfo.value);
                return;
            }
        } catch (error) {
            console.warn('Error con ip-api.com, intentando con otro servicio:', error);
        }

        // Último intento con ipapi.co
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();

        locationInfo.value = {
            ip: data.ip || null,
            country: data.country_name || null,
            region: data.region || null,
            city: data.city || null,
            latitude: data.latitude || null,
            longitude: data.longitude || null,
            timezone: data.timezone || null,
            isp: data.org || null
        };

        console.log('Información de ubicación obtenida de ipapi.co:', locationInfo.value);
    } catch (error) {
        console.error('Error al obtener información de ubicación:', error);
        // Valores por defecto en caso de error
        locationInfo.value = {
            ip: '0.0.0.0',
            country: 'Desconocido',
            region: 'Desconocido',
            city: 'Desconocido'
        };
    }
};

// Función alternativa para obtener la ubicación mediante la API de Geolocalización del navegador
const getGeolocation = () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                // Si tenemos las coordenadas, obtener la ciudad y país mediante un servicio de geocodificación inversa
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json`);
                    const data = await response.json();

                    // Actualizar la información de ubicación con datos más precisos
                    if (data && data.address) {
                        const address = data.address;

                        // Mantener la IP existente si la tenemos
                        const currentIp = locationInfo.value.ip;

                        locationInfo.value = {
                            ip: currentIp, // Mantener IP
                            country: address.country || 'Desconocido',
                            region: address.state || address.county || 'Desconocido',
                            city: address.city || address.town || address.village || 'Desconocido',
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                            isp: locationInfo.value.isp || null, // Mantener ISP si existe
                            // Agregar precisión más alta
                            accuracy: position.coords.accuracy,
                            altitude: position.coords.altitude,
                            altitudeAccuracy: position.coords.altitudeAccuracy,
                            geolocationUsed: true
                        };

                        console.log('Información de ubicación mejorada con geolocalización:', locationInfo.value);
                    }
                } catch (error) {
                    console.warn('Error al obtener datos de geocodificación inversa:', error);

                    // Actualizar solo las coordenadas
                    locationInfo.value = {
                        ...locationInfo.value,
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        geolocationUsed: true
                    };
                }
            },
            (error) => {
                console.warn('Error de geolocalización:', error.message);
                // Continuamos con la información de IP que ya tenemos
            },
            { timeout: 5000, enableHighAccuracy: false }
        );
    }
};

// Recopilar la información tan pronto como se abra el modal
onMounted(() => {
    if (props.isOpen) {
        collectBrowserInfo();
        getLocationInfo().then(() => {
            // Intentar obtener ubicación más precisa después de tener la IP
            getGeolocation();
        });
    }
});

// Observar cambios en isOpen para recopilar info cuando se abre el modal
watch(() => props.isOpen, (newValue) => {
    if (newValue === true) {
        collectBrowserInfo();
        getLocationInfo().then(() => {
            // Intentar obtener ubicación más precisa después de tener la IP
            getGeolocation();
        });
        hasAccepted.value = false; // Resetear el checkbox de aceptación cuando se abre de nuevo
    }
});

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

// Visitar la URL después de aceptar
const visitUrl = async () => {
    if (!props.url) return;

    // Verificar si el usuario ha aceptado los términos
    if (!hasAccepted.value) {
        // Si no ha aceptado, mostrar un mensaje o algún tipo de indicación
        alert('Debes aceptar los términos para continuar');
        return;
    }

    try {
        loading.value = true;

        // Actualizar información del navegador
        const navigatorInfo = collectBrowserInfo();

        // Crear objeto con la información limpia (sin valores undefined)
        const visitorInfo = {
            consentTimestamp: new Date().toISOString(),
            acceptedTerms: true,
            // Añadir información del navegador limpia
            browserInfo: cleanUndefined(navigatorInfo),
            // Añadir información de ubicación
            ...cleanUndefined(locationInfo.value)
        };

        // Log para debugging
        console.log('Información completa que se enviará:', visitorInfo);

        // Emitir evento para indicar visita confirmada
        emit('visit-confirmed', { url: props.url, visitorInfo });

        // Redirigir al usuario a la URL original en una nueva pestaña
        window.open(props.url.original, '_blank');

        // Cerrar el modal después de un breve retraso
        setTimeout(() => {
            emit('close');
        }, 500);
    } catch (err) {
        console.error('Error al procesar la visita:', err);
    } finally {
        loading.value = false;
        hasAccepted.value = false;
    }
};

// Función para contar las visitas recientes (últimos 30 días)
const recentVisits = computed(() => {
    if (!props.url || !props.url.visitDetails) return 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return props.url.visitDetails.filter(visit => {
        if (!visit.timestamp) return false;
        const visitDate = new Date(visit.timestamp);
        return visitDate >= thirtyDaysAgo;
    }).length;
});

// Función para verificar si hay visitas desde dispositivos móviles
const mobileVisitsPercent = computed(() => {
    if (!props.url || !props.url.visitDetails || props.url.visitDetails.length === 0) return 0;

    const mobileVisits = props.url.visitDetails.filter(visit => {
        return visit.userAgent && (
            visit.userAgent.includes('Android') ||
            visit.userAgent.includes('iPhone') ||
            visit.userAgent.includes('iPad') ||
            visit.userAgent.includes('Mobile')
        );
    }).length;

    return Math.round((mobileVisits / props.url.visitDetails.length) * 100);
});

// Función para obtener los 3 países con más visitas
const topCountries = computed(() => {
    if (!props.url || !props.url.visitDetails || props.url.visitDetails.length === 0) return [];

    const countryCounts = {};

    props.url.visitDetails.forEach(visit => {
        if (visit.country) {
            countryCounts[visit.country] = (countryCounts[visit.country] || 0) + 1;
        }
    });

    return Object.entries(countryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([country, count]) => ({ country, count }));
});
</script>

<template>
    <div v-if="isOpen && url"
        class="fixed inset-0 bg-black bg-opacity-60 overflow-y-auto h-full w-full flex items-center justify-center z-50">
        <div
            class="relative mx-auto p-5 border w-full max-w-xl shadow-lg rounded-md bg-gradient-to-r from-pink-600 via-pink-700 to-purple-800">
            <!-- Botón X para cerrar (arriba a la derecha) -->
            <button @click="emit('close')"
                class="absolute top-3 right-3 text-white hover:text-gray-200 focus:outline-none">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            <div class="mt-3 text-center">
                <h3 class="text-lg leading-6 font-medium text-white mb-3">Visitar URL Externa</h3>

                <div class="mt-4 px-7 py-3">
                    <!-- Información de la URL -->
                    <div class="bg-white bg-opacity-10 p-4 rounded-md mb-4 text-left">
                        <p class="text-white font-medium text-lg">{{ url.name }}</p>
                        <p class="text-white text-opacity-90 truncate">{{ url.original }}</p>
                        <div class="flex items-center mt-1">
                            <span class="text-xs px-2 py-1 rounded-full" :class="{
                                'bg-yellow-100 text-yellow-800': url.status === 'pending',
                                'bg-green-100 text-green-800': url.status === 'approved',
                                'bg-red-100 text-red-800': url.status === 'rejected'
                            }">
                                {{ url.status === 'pending' ? 'Pendiente' : url.status === 'approved' ? 'Aprobada' :
                                    'Rechazada' }}
                            </span>
                            <span class="text-white text-opacity-80 text-xs ml-2">
                                {{ url.visits || 0 }} visitas totales
                            </span>
                        </div>
                    </div>

                    <!-- Información de visitas -->
                    <div class="bg-white bg-opacity-10 p-4 rounded-md mb-6 text-left">
                        <h4 class="text-white mb-2 font-medium">Estadísticas de visitas</h4>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div class="bg-white bg-opacity-20 p-3 rounded-md text-center">
                                <div class="text-2xl font-bold text-lime-400">{{ recentVisits }}</div>
                                <div class="text-white text-xs">Visitas recientes</div>
                            </div>

                            <div class="bg-white bg-opacity-20 p-3 rounded-md text-center">
                                <div class="text-2xl font-bold text-lime-400">{{ mobileVisitsPercent }}%</div>
                                <div class="text-white text-xs">Desde móviles</div>
                            </div>

                            <div class="bg-white bg-opacity-20 p-3 rounded-md text-center">
                                <div class="text-sm font-bold text-lime-400">
                                    <div v-for="(item, index) in topCountries" :key="index" class="truncate">
                                        {{ item.country }}
                                    </div>
                                    <div v-if="topCountries.length === 0">Sin datos</div>
                                </div>
                                <div class="text-white text-xs">Países principales</div>
                            </div>
                        </div>
                    </div>

                    <!-- Mensaje de política de privacidad -->
                    <div class="bg-white rounded-md p-4 mb-4 text-left">
                        <h4 class="font-medium text-gray-800 mb-2">Política de privacidad</h4>
                        <p class="text-sm text-gray-600 mb-3">
                            Al visitar esta URL externa, aceptas que:
                        </p>
                        <ul class="text-sm text-gray-600 list-disc pl-5 space-y-1 mb-3">
                            <li>Se recopilen datos anónimos de tu visita (dispositivo, navegador, ubicación, etc.).</li>
                            <li>La información recopilada se utilice únicamente para análisis estadístico.</li>
                            <li>No se compartirán tus datos con terceros.</li>
                            <li>La información recopilada se utilice para mejorar tu experiencia.</li>
                            <li>Aceptas los términos y condiciones del sitio externo.</li>
                        </ul>

                        <div class="flex items-center mt-4">
                            <input id="accept-policy" type="checkbox" v-model="hasAccepted"
                                class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded">
                            <label for="accept-policy" class="ml-2 block text-sm text-gray-700">
                                He leído y acepto las condiciones
                            </label>
                        </div>
                    </div>

                    <!-- Botones de acción -->
                    <div class="flex justify-between">
                        <button @click="emit('close')"
                            class="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-md focus:outline-none">
                            Cancelar
                        </button>

                        <button @click="visitUrl" :disabled="loading || !hasAccepted"
                            class="button-custom font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed">
                            <span v-if="loading">Procesando...</span>
                            <span v-else>Visitar URL</span>
                        </button>
                    </div>
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
</style>