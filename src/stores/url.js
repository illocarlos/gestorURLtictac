import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '../config/firebase'
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore'
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

    // Getters
    const countUrls = computed(() => urls.value.length)
    const currentUrl = computed(() =>
        urls.value.find(url => url.id === currentUrlId.value) || null
    )

    // Acciones
    async function fetchUrls() {
        loading.value = true
        error.value = null
        try {
            const querySnapshot = await getDocs(collection(db, 'urls'))
            urls.value = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
        } catch (e) {
            console.error('Error al obtener URLs:', e)
            error.value = e.message
        } finally {
            loading.value = false
        }
    }

    async function addUrl(urlData) {
        loading.value = true
        error.value = null
        try {
            const docRef = await addDoc(collection(db, 'urls'), {
                name: urlData.name,
                original: urlData.original,
                createdAt: new Date(),
                status: 'pending', // 'pending', 'approved', 'rejected'
                errorMessages: [],
                visits: 0,
                visitDetails: [] // Array para almacenar detalles de cada visita
            })

            // Añadir la nueva URL al estado local
            const newUrl = {
                id: docRef.id,
                name: urlData.name,
                original: urlData.original,
                createdAt: new Date(),
                status: 'pending',
                errorMessages: [],
                visits: 0,
                visitDetails: []
            }

            urls.value.unshift(newUrl)
            return docRef.id
        } catch (e) {
            console.error('Error al añadir URL:', e)
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

    // Función modificada para registrar información detallada de visitas
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

    // Función para obtener dominios únicos de las URLs
    function getUniqueDomains() {
        const domains = new Set();

        urls.value.forEach(url => {
            try {
                const urlObj = new URL(url.original);
                domains.add(urlObj.hostname);
            } catch (e) {
                // Si no es una URL válida, ignorarla
            }
        });

        return Array.from(domains);
    }

    // Función para obtener URLs por dominio
    function getUrlsByDomain(domain) {
        return urls.value.filter(url => {
            try {
                const urlObj = new URL(url.original);
                return urlObj.hostname === domain;
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
        // Getters
        countUrls,
        currentUrl,
        // Acciones
        fetchUrls,
        addUrl,
        approveUrl,
        rejectUrl,
        incrementVisits,
        openModal,
        closeModal,
        addErrorMessage,
        removeErrorMessage,
        submitErrorMessages,
        getUniqueDomains,
        getUrlsByDomain,
        // Helpers de imágenes
        getErrorImageUrl,
        isLocalImage
    }
})