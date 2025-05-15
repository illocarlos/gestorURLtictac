import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '../config/firebase'
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, getDoc, arrayUnion, setDoc } from 'firebase/firestore'
import useImages from '../composables/useImages'

export const useUrlStore = defineStore('url', () => {
    // Inicializar el composable de imágenes
    const {
        uploadImages,
        getImageDisplayUrl,
        isLocalImage,
        uploadingStatus
    } = useImages('error-images');

    // Estado
    const urls = ref([])
    const loading = ref(false)
    const error = ref(null)
    const modalOpen = ref(false)
    const currentUrlId = ref(null)
    const errorMessages = ref([])
    const domainOrder = ref([]) // Nueva variable para almacenar el orden de los dominios

    // Getters
    const countUrls = computed(() => urls.value.length)
    const currentUrl = computed(() =>
        urls.value.find(url => url.id === currentUrlId.value) || null
    )

    // Extrae el dominio de una URL
    const extractDomain = (url) => {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch (e) {
            // En caso de URL inválida, devolver la URL original
            return url;
        }
    };

    // Acciones
    async function fetchUrls() {
        loading.value = true
        error.value = null
        try {
            console.log('⚠️ Store: fetchUrls started');
            const querySnapshot = await getDocs(collection(db, 'urls'))
            urls.value = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            console.log('⚠️ Store: urls loaded:', urls.value.length);

            // Obtener el orden de dominios si existe
            try {
                console.log('⚠️ Store: Getting domain order from Firestore');
                const orderDoc = await getDoc(doc(db, 'settings', 'domainOrder'));
                if (orderDoc.exists()) {
                    console.log('⚠️ Store: Domain order found in Firestore:', orderDoc.data().order);
                    domainOrder.value = orderDoc.data().order || [];
                } else {
                    // Si no existe un orden guardado, generar uno predeterminado
                    console.log('⚠️ Store: No domain order found, generating default');
                    const domains = getUniqueDomains();
                    console.log('⚠️ Store: Unique domains generated:', domains);
                    domainOrder.value = domains;

                    // Guardar el orden predeterminado
                    await saveDomainOrder(domains);
                }
            } catch (orderErr) {
                console.warn('⚠️ Store: Error al obtener orden de dominios:', orderErr);
                // Si hay error, generar orden predeterminado
                const domains = getUniqueDomains();
                console.log('⚠️ Store: Fallback to unique domains:', domains);
                domainOrder.value = domains;
            }

            // Verificar la estructura final de domainOrder
            console.log('⚠️ Store: Final domain order:', domainOrder.value);
        } catch (e) {
            console.error('⚠️ Store: Error al obtener URLs:', e)
            error.value = e.message
        } finally {
            loading.value = false
        }
    }

    // Nueva función para guardar el orden de dominios con corrección para filtrar undefined/null
    async function saveDomainOrder(newOrder) {
        loading.value = true;
        error.value = null;
        try {
            console.log('⚠️ Store: saveDomainOrder called with:', newOrder);

            // Filtrar valores undefined o null del array
            const cleanOrder = newOrder.filter(item => item !== undefined && item !== null);
            console.log('⚠️ Store: Cleaned order:', cleanOrder);
            // Verificar que cleanOrder no esté vacío
            if (!cleanOrder || cleanOrder.length === 0) {
                const error = new Error('El orden de dominios no puede estar vacío');
                console.error('⚠️ Store:', error.message);
                throw error;
            }
            
            // Guardar el orden limpio en Firestore
            console.log('⚠️ Store: Saving domain order to Firestore');
            await setDoc(doc(db, 'settings', 'domainOrder'), {
                order: cleanOrder,
                updatedAt: new Date()
            });
            console.log('⚠️ Store: Domain order saved successfully');

            // Actualizar el estado local
            domainOrder.value = cleanOrder;
            console.log('⚠️ Store: Local domain order updated:', domainOrder.value);
            return true;
        } catch (e) {
            console.error('⚠️ Store: Error al guardar el orden de dominios:', e);
            error.value = e.message;
            return false;
        } finally {
            loading.value = false;
        }
    }

    // Añadir logs a la función getUniqueDomains
    function getUniqueDomains() {
        console.log('⚠️ Store: getUniqueDomains called');
        const domains = new Set();

        urls.value.forEach(url => {
            try {
                const domain = extractDomain(url.original);
                console.log(`⚠️ Store: Extracted domain from ${url.original}: ${domain}`);
                domains.add(domain);
            } catch (e) {
                // Si no es una URL válida, ignorarla
                console.warn('⚠️ Store: URL inválida al extraer dominio:', url.original);
            }
        });

        const result = Array.from(domains);
        console.log('⚠️ Store: Unique domains found:', result);
        return result;
    }

    // Añadir logs a la función addUrl
    async function addUrl(urlData) {
        loading.value = true
        error.value = null
        try {
            console.log('⚠️ Store: addUrl called with:', urlData);
            const docRef = await addDoc(collection(db, 'urls'), {
                name: urlData.name,
                original: urlData.original,
                site_name: urlData.site_name || '',
                createdAt: new Date(),
                status: 'pending', // 'pending', 'approved', 'rejected'
                errorMessages: [],
                visits: 0,
                visitDetails: [] // Array para almacenar detalles de cada visita
            })
            console.log('⚠️ Store: URL added with ID:', docRef.id);

            // Añadir la nueva URL al estado local
            const newUrl = {
                id: docRef.id,
                name: urlData.name,
                original: urlData.original,
                site_name: urlData.site_name || '',
                createdAt: new Date(),
                status: 'pending',
                errorMessages: [],
                visits: 0,
                visitDetails: []
            }

            urls.value.unshift(newUrl)
            console.log('⚠️ Store: URL added to local state');

            // Comprobar si el dominio ya está en el orden, si no, añadirlo
            const domain = extractDomain(urlData.original);
            console.log('⚠️ Store: Extracted domain for new URL:', domain);
            console.log('⚠️ Store: Current domain order:', domainOrder.value);
            console.log('⚠️ Store: Domain already in order?', domainOrder.value.includes(domain));
            
            if (!domainOrder.value.includes(domain)) {
                console.log('⚠️ Store: Adding new domain to order');
                const newOrder = [domain, ...domainOrder.value];
                console.log('⚠️ Store: New domain order:', newOrder);
                await saveDomainOrder(newOrder);
                console.log('⚠️ Store: Domain order updated with new domain');
            }

            return docRef.id
        } catch (e) {
            console.error('⚠️ Store: Error al añadir URL:', e)
            error.value = e.message
            return null
        } finally {
            loading.value = false
        }
    }

    async function approveUrl(id) {
        loading.value = true
        error.value = null
        try {
            const urlRef = doc(db, 'urls', id)
            await updateDoc(urlRef, {
                status: 'approved',
                errorMessages: []
            })

            // Actualizar el estado local
            const url = urls.value.find(u => u.id === id)
            if (url) {
                url.status = 'approved'
                url.errorMessages = []
            }

            return true
        } catch (e) {
            console.error('Error al aprobar URL:', e)
            error.value = e.message
            return false
        } finally {
            loading.value = false
        }
    }

    // Función para rechazar URL con mensajes e imágenes
    async function rejectUrl(id, newMessages) {
        loading.value = true;
        error.value = null;
        try {
            // Obtener el documento actual para acceder a los errores existentes
            const urlRef = doc(db, 'urls', id);
            const urlDoc = await getDoc(urlRef);

            if (urlDoc.exists()) {
                // Obtener los errores existentes (si hay alguno)
                const urlData = urlDoc.data();
                const existingMessages = urlData.errorMessages || [];

                // Combinar errores existentes con los nuevos
                const combinedMessages = [...existingMessages, ...newMessages];

                // Actualizar el documento con todos los errores
                await updateDoc(urlRef, {
                    status: 'rejected',
                    errorMessages: combinedMessages
                });

                // Actualizar el estado local
                const url = urls.value.find(u => u.id === id);
                if (url) {
                    url.status = 'rejected';
                    url.errorMessages = combinedMessages;
                }

                return true;
            } else {
                console.error('URL no encontrada');
                error.value = 'URL no encontrada';
                return false;
            }
        } catch (e) {
            console.error('Error al rechazar URL:', e);
            error.value = e.message;
            return false;
        } finally {
            loading.value = false;
        }
    }

    // Función mejorada para eliminar un mensaje de error específico de una URL
    async function removeErrorFromUrl(urlId, errorIndex) {
        loading.value = true;
        error.value = null;

        console.log(`Store: Eliminando error índice ${errorIndex} de URL ${urlId}`);

        try {
            // Obtener la URL actual de Firestore
            const urlRef = doc(db, 'urls', urlId);
            const urlDoc = await getDoc(urlRef);

            if (urlDoc.exists()) {
                const urlData = urlDoc.data();
                const errorMessages = [...(urlData.errorMessages || [])];

                // Verificar que existe el error y el índice es válido
                if (errorIndex >= 0 && errorIndex < errorMessages.length) {
                    // Eliminar el error según el índice
                    errorMessages.splice(errorIndex, 1);

                    // Actualizar en Firestore
                    await updateDoc(urlRef, { errorMessages });

                    // Actualizar en el estado local
                    const url = urls.value.find(u => u.id === urlId);
                    if (url && url.errorMessages) {
                        url.errorMessages.splice(errorIndex, 1);
                    }

                    // Si no quedan errores y el estado es "rejected", cambiar a "pending"
                    if (errorMessages.length === 0 && urlData.status === 'rejected') {
                        await updateDoc(urlRef, { status: 'pending' });

                        // Actualizar en el estado local
                        if (url) {
                            url.status = 'pending';
                        }
                    }

                    return true;
                } else {
                    console.warn(`Índice de error inválido: ${errorIndex}, total errores: ${errorMessages.length}`);
                }
            } else {
                console.warn(`URL no encontrada: ${urlId}`);
            }
            return false;
        } catch (e) {
            console.error('Error al eliminar mensaje de error:', e);
            error.value = e.message;
            return false;
        } finally {
            loading.value = false;
        }
    }

    async function recordVisit(id, visitorInfo = null) {
        loading.value = true;
        error.value = null;
        try {
            const urlRef = doc(db, 'urls', id);
            const urlDoc = await getDoc(urlRef);

            if (!urlDoc.exists()) {
                throw new Error('La URL no existe');
            }

            const urlData = urlDoc.data();

            // Función para limpiar valores undefined
            const cleanUndefined = (obj) => {
                if (obj === undefined || obj === null) return null;

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

            // Recopilar información básica sobre la visita
            const visitData = {
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent || null,
                referrer: document.referrer || 'Directo',
                screenSize: `${window.screen.width}x${window.screen.height}`,
                // Valores por defecto que serán reemplazados si hay información del visitante
                country: 'Desconocido',
                region: 'Desconocido',
                city: 'Desconocido',
                ip: '0.0.0.0',
            };

            // Añadir toda la información del visitante si está disponible
            if (visitorInfo) {
                // Información básica
                if (visitorInfo.email) visitData.email = visitorInfo.email;
                if (visitorInfo.consentTimestamp) visitData.consentTimestamp = visitorInfo.consentTimestamp;
                if (visitorInfo.acceptedTerms !== undefined) visitData.acceptedTerms = visitorInfo.acceptedTerms;

                // Información de ubicación
                if (visitorInfo.ip) visitData.ip = visitorInfo.ip;
                if (visitorInfo.country) visitData.country = visitorInfo.country;
                if (visitorInfo.region) visitData.region = visitorInfo.region;
                if (visitorInfo.city) visitData.city = visitorInfo.city;
                if (visitorInfo.latitude) visitData.latitude = visitorInfo.latitude;
                if (visitorInfo.longitude) visitData.longitude = visitorInfo.longitude;
                if (visitorInfo.isp) visitData.isp = visitorInfo.isp;

                // Información detallada del navegador si está disponible
                if (visitorInfo.browserInfo) {
                    // Asegurarse de que no hay valores undefined
                    visitData.browserInfo = cleanUndefined(visitorInfo.browserInfo);
                }

                // Log para debug
                console.log("Guardando visita con información detallada:", visitData);
            }

            // Limpiar una última vez para asegurarnos de que no hay valores undefined
            const cleanVisitData = cleanUndefined(visitData);

            // Actualizar el documento con la nueva visita
            await updateDoc(urlRef, {
                visits: (urlData.visits || 0) + 1,
                visitDetails: arrayUnion(cleanVisitData)
            });

            // Actualizar la copia local
            const url = urls.value.find(u => u.id === id);
            if (url) {
                // Incrementar contador
                url.visits = (url.visits || 0) + 1;

                // Asegurarnos de que visitDetails existe
                if (!url.visitDetails) {
                    url.visitDetails = [];
                }

                // Añadir los detalles de la visita
                url.visitDetails.push(cleanVisitData);
            }

            return true;
        } catch (e) {
            console.error('Error al registrar visita:', e);
            error.value = `Error al registrar visita: ${e.message}`;
            return false;
        } finally {
            loading.value = false;
        }
    }

    async function incrementVisits(id, visitorInfo = null) {
        try {
            const urlRef = doc(db, 'urls', id)
            const urlDoc = await getDoc(urlRef)

            if (urlDoc.exists()) {
                const urlData = urlDoc.data()
                const newVisits = (urlData.visits || 0) + 1

                // Preparar información básica de la visita
                const visit = {
                    timestamp: new Date().toISOString(),
                    ...visitorInfo || {}
                }

                // Actualizar documento con contador y detalles de la visita
                const updateData = {
                    visits: newVisits
                }

                // Si hay detalles de visita, añadirlos al array
                if (visitorInfo) {
                    updateData.visitDetails = arrayUnion(visit)
                }

                await updateDoc(urlRef, updateData)

                // Actualizar el estado local
                const url = urls.value.find(u => u.id === id)
                if (url) {
                    url.visits = newVisits

                    // Inicializar array de visitDetails si no existe
                    if (!url.visitDetails) {
                        url.visitDetails = []
                    }

                    // Añadir detalles de visita si se proporcionaron
                    if (visitorInfo) {
                        url.visitDetails.push(visit)
                    }
                }

                return true
            }
            return false
        } catch (e) {
            console.error('Error al incrementar visitas:', e)
            error.value = e.message
            return false
        }
    }

    function openModal(id) {
        currentUrlId.value = id;
        errorMessages.value = [];
        modalOpen.value = true;
    }

    function closeModal() {
        modalOpen.value = false;
        currentUrlId.value = null;
        errorMessages.value = [];
    }

    // Función para añadir errores con imágenes usando el composable
    async function addErrorMessage(errorData) {
        try {
            // Si recibimos un objeto completo con texto e imagen
            if (typeof errorData === 'object' && errorData.text) {
                // Si ya viene con una imageUrl (desde el componente que usa el composable)
                if (errorData.imageUrl) {
                    errorMessages.value.push({
                        text: errorData.text.trim(),
                        imageUrl: errorData.imageUrl,
                        imagePreview: errorData.imagePreview,
                        timestamp: new Date()
                    });
                    return;
                }

                // Si viene con image (archivo) pero no imageUrl, subir la imagen
                if (errorData.image) {
                    console.log('Procesando imagen en el store');
                    // Usar el composable para subir la imagen
                    const uploadedUrls = await uploadImages([errorData.image]);

                    // Añadir mensaje con la URL resultante
                    errorMessages.value.push({
                        text: errorData.text.trim(),
                        imageUrl: uploadedUrls && uploadedUrls.length > 0 ? uploadedUrls[0] : null,
                        imagePreview: errorData.imagePreview, // Guardar preview para fallback
                        timestamp: new Date()
                    });
                } else {
                    // Si no hay imagen, solo añadir el texto
                    errorMessages.value.push({
                        text: errorData.text.trim(),
                        imageUrl: null,
                        timestamp: new Date()
                    });
                }
            }
            // Compatibilidad con la versión anterior (solo texto)
            else if (typeof errorData === 'string' && errorData.trim() !== '') {
                errorMessages.value.push({
                    text: errorData.trim(),
                    imageUrl: null,
                    timestamp: new Date()
                });
            }
        } catch (e) {
            console.error('Error en addErrorMessage:', e);
            error.value = `Error al añadir mensaje: ${e.message}`;
        }
    }

    function removeErrorMessage(index) {
        if (index >= 0 && index < errorMessages.value.length) {
            errorMessages.value.splice(index, 1);
        }
    }

    // Función para obtener la URL de visualización de una imagen
    function getErrorImageUrl(imageUrl, fallbackUrl = null) {
        if (isLocalImage(imageUrl) && fallbackUrl) {
            return fallbackUrl;
        }
        return getImageDisplayUrl(imageUrl);
    }

    // Función para enviar errores
    async function submitErrorMessages() {
        if (currentUrlId.value && errorMessages.value.length > 0) {
            try {
                console.log('Enviando mensajes de error:', errorMessages.value);

                // Llamar a rejectUrl con solo los NUEVOS mensajes
                const result = await rejectUrl(currentUrlId.value, [...errorMessages.value]);

                if (result) {
                    console.log('Errores registrados con éxito');
                    // Actualizar la lista después de registrar errores
                    await fetchUrls();
                    closeModal();
                    return true;
                }
            } catch (e) {
                console.error('Error en submitErrorMessages:', e);
                error.value = `Error al enviar mensajes: ${e.message}`;
            }
        }
        return false;
    }

    // Función para obtener URLs por dominio
    function getUrlsByDomain(domain) {
        return urls.value.filter(url => {
            try {
                return extractDomain(url.original) === domain;
            } catch (e) {
                return false;
            }
        });
    }

    return {
        // Estado
        urls,
        loading,
        error,
        modalOpen,
        currentUrlId,
        errorMessages,
        uploadingStatus,
        domainOrder,  // Exponer domainOrder
        // Getters
        countUrls,
        currentUrl,
        // Acciones
        fetchUrls,
        addUrl,
        approveUrl,
        rejectUrl,
        incrementVisits,
        recordVisit,
        removeErrorFromUrl, // Función mejorada para eliminar un error de una URL
        openModal,
        closeModal,
        addErrorMessage,
        removeErrorMessage,
        submitErrorMessages,
        getUniqueDomains,
        getUrlsByDomain,
        saveDomainOrder, // Exponer la función para guardar el orden
        // Helpers de imágenes
        getErrorImageUrl,
        isLocalImage,
        extractDomain
    }
})