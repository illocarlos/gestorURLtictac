import { computed, ref } from 'vue'
import { uid } from 'uid'

/**
 * Composable para manejo de imágenes con Cloudinary
 */
export default function useImages(folderPath = 'error-images') {
    const imageUrls = ref([]);
    const uploadingStatus = ref(false);
    const uploadError = ref(null);

    // Configuración de Cloudinary (reemplaza con tus credenciales)
    const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const CLOUDINARY_API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY;
    // IMPORTANTE: No incluir el API Secret en código del lado del cliente

    // URL de la API de subida sin autorización firmada (usa unsigned upload)
    const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

    // Para unsigned uploads necesitas un upload preset configurado como "Enable unsigned uploading"
    const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET; // Cambia a tu preset para unsigned uploads

    function $reset() {
        imageUrls.value = [];
        uploadError.value = null;
    }

    /**
     * Sube imágenes a Cloudinary
     * @param {File[]} files - Archivos a subir
     * @returns {Promise<string[]>} - URLs de las imágenes subidas
     */
    async function uploadImages(files) {
        uploadingStatus.value = true;
        uploadError.value = null;
        const uploadPromises = [];

        try {
            for (const file of files) {
                if (!file) continue;

                // Generar un ID único para la imagen
                const uniqueId = `${Date.now()}_${uid()}`;

                // Preparar el FormData para la subida
                const formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
                formData.append('api_key', CLOUDINARY_API_KEY);
                formData.append('folder', folderPath);
                formData.append('public_id', uniqueId);

                console.log(`Subiendo archivo ${file.name} a Cloudinary...`);
                console.log(`URL de subida: ${CLOUDINARY_UPLOAD_URL}`);
                console.log(`Upload preset: ${CLOUDINARY_UPLOAD_PRESET}`);

                // Realizar la subida
                const uploadPromise = fetch(CLOUDINARY_UPLOAD_URL, {
                    method: 'POST',
                    body: formData
                })
                    .then(response => {
                        console.log(`Respuesta de Cloudinary: ${response.status} ${response.statusText}`);

                        if (!response.ok) {
                            return response.text().then(text => {
                                console.error('Error detallado:', text);
                                throw new Error(`Error en la subida: ${response.status} ${response.statusText}`);
                            });
                        }

                        return response.json();
                    })
                    .then(data => {
                        console.log('Respuesta completa de Cloudinary:', data);
                        console.log('Imagen subida con éxito. URL:', data.secure_url);

                        const imageUrl = data.secure_url;
                        imageUrls.value.push(imageUrl);
                        return imageUrl;
                    })
                    .catch(error => {
                        console.error('Error al subir imagen:', error);
                        throw error;
                    });

                uploadPromises.push(uploadPromise);
            }

            // Esperar a que todas las subidas se completen
            const results = await Promise.all(uploadPromises);
            console.log('Todas las imágenes fueron subidas:', results);

            return results;
        } catch (error) {
            console.error('Error en el proceso de subida:', error);
            uploadError.value = error.message;
            return [];
        } finally {
            uploadingStatus.value = false;
        }
    }

    /**
     * Maneja la carga de imágenes desde un input file
     */
    function uploadImage(e) {
        const files = e.target.files;

        if (files && files.length > 0) {
            return uploadImages(Array.from(files))
                .then((urls) => {
                    console.log('Upload image completo:', urls);
                    return urls;
                })
                .catch((error) => {
                    console.error('Error en uploadImage:', error);
                    uploadError.value = error.message;
                    return [];
                });
        }

        return Promise.resolve([]);
    }

    // Estas funciones ya no realizan lógica local, pero se mantienen por compatibilidad
    function isLocalImage() {
        return false;
    }

    function getImageDisplayUrl(url) {
        return url;
    }

    // Computed para obtener todas las imágenes
    const images = computed(() => {
        return imageUrls.value.length > 0 ? imageUrls.value : null;
    });

    return {
        uploadImage,
        uploadImages,
        images,
        imageUrls,
        uploadingStatus,
        uploadError,
        $reset,
        getImageDisplayUrl,
        isLocalImage
    };
}