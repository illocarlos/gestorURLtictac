// src/stores/theme.js
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useAuthStore } from './auth';

export const useThemeStore = defineStore('theme', () => {
    // Estado
    const defaultTheme = {
        primary: '#EC4899', // Rosa equivalente a pink-600
        secondary: '#9333EA', // Púrpura equivalente a purple-800
        primary2: '#EC4899', // Rosa equivalente a pink-600
        secondary2: '#9333EA', // Púrpura equivalente a purple-800
        accent: '#BBF33A', // Verde lima del botón actual
        accent2: '#BBF33A', // Verde lima del botón actual
        background: '#F3F4F6', // Gris claro para el fondo
        background2: '#F3F4F6', // Gris claro para el fondo
        text: '#111827', // Color de texto oscuro
        text2: '#111827', // Color de texto oscuro
        name: 'Default'
    };

    const currentTheme = ref({ ...defaultTheme });
    const savedThemes = ref([]);
    const loading = ref(false);
    const error = ref(null);
    const themeModalOpen = ref(false);

    // Obtener store de autenticación
    const authStore = useAuthStore();

    // Getters fondo para contenido
    const primaryColor = computed(() => currentTheme.value.primary);
    const secondaryColor = computed(() => currentTheme.value.secondary);

    // Getters fondo secundario para contenido
    const primaryColor2 = computed(() => currentTheme.value.primary);
    const secondaryColor2 = computed(() => currentTheme.value.secondary);

    // color botones
    const accentColor = computed(() => currentTheme.value.accent);
    const backgroundColor = computed(() => currentTheme.value.background);
    const textColor = computed(() => currentTheme.value.text);


    // color botones2
    const accentColor2 = computed(() => currentTheme.value.accent);
    const backgroundColor2 = computed(() => currentTheme.value.background);
    const textColor2 = computed(() => currentTheme.value.text);


    // Getter para variables CSS
    const cssVars = computed(() => {
        return {
            '--color-primary': currentTheme.value.primary,
            '--color-secondary': currentTheme.value.secondary,
            '--color-primary-2': currentTheme.value.primary,
            '--color-secondary-2': currentTheme.value.secondary,
            '--color-accent': currentTheme.value.accent,
            '--color-background': currentTheme.value.background,
            '--color-text': currentTheme.value.text,
            '--color-accent-2': currentTheme.value.accent,
            '--color-background-2': currentTheme.value.background,
            '--color-text-2': currentTheme.value.text,
        };
    });

    // Acciones

    // Inicializar temas
    async function init() {
        loading.value = true;
        error.value = null;

        try {
            // Intentar cargar el tema guardado del usuario actual
            if (authStore.user?.uid) {
                const userThemeRef = doc(db, 'userThemes', authStore.user.uid);
                const userThemeDoc = await getDoc(userThemeRef);

                if (userThemeDoc.exists()) {
                    // Si el usuario tiene un tema guardado, usarlo
                    const themeData = userThemeDoc.data();
                    currentTheme.value = { ...themeData };
                    console.log('Tema del usuario cargado:', themeData);
                } else {
                    // Si no, usar el tema por defecto
                    currentTheme.value = { ...defaultTheme };
                    console.log('Usando tema por defecto');
                }

                // Aplicar el tema a las variables CSS
                applyTheme();
            }

            // Cargar todos los temas guardados
            await fetchSavedThemes();

        } catch (e) {
            console.error('Error al inicializar temas:', e);
            error.value = e.message;
        } finally {
            loading.value = false;
        }
    }

    // Obtener todos los temas guardados
    async function fetchSavedThemes() {
        try {
            // Obtener los temas globales
            const themesRef = collection(db, 'themes');
            const querySnapshot = await getDocs(themesRef);

            const themes = [];
            querySnapshot.forEach(doc => {
                themes.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // Si el usuario está autenticado, obtener también sus temas personales
            if (authStore.user?.uid) {
                const userThemesRef = collection(db, 'userThemes');
                const userQuery = query(userThemesRef, where('userId', '==', authStore.user.uid));
                const userThemesSnapshot = await getDocs(userQuery);

                userThemesSnapshot.forEach(doc => {
                    // Añadir solo si tiene un nombre (es un tema guardado, no configuración actual)
                    if (doc.data().name) {
                        themes.push({
                            id: doc.id,
                            ...doc.data(),
                            isUserTheme: true
                        });
                    }
                });
            }

            savedThemes.value = themes;
            console.log('Temas guardados cargados:', themes.length);

        } catch (e) {
            console.error('Error al cargar temas guardados:', e);
            error.value = e.message;
        }
    }

    // Guardar el tema actual
    async function saveCurrentTheme(themeName) {
        if (!themeName.trim()) {
            error.value = 'El nombre del tema no puede estar vacío';
            return false;
        }

        loading.value = true;
        error.value = null;

        try {
            // Crear objeto del tema
            const themeData = {
                ...currentTheme.value,
                name: themeName.trim(),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Si hay usuario, añadir referencia
            if (authStore.user?.uid) {
                themeData.userId = authStore.user.uid;
                themeData.userEmail = authStore.user.email;
            }

            // Guardar en colección de temas
            const themesRef = collection(db, 'themes');
            const newThemeRef = doc(themesRef);
            await setDoc(newThemeRef, themeData);

            // Añadir a temas guardados
            savedThemes.value.push({
                id: newThemeRef.id,
                ...themeData
            });

            console.log('Tema guardado con éxito:', themeName);
            return true;

        } catch (e) {
            console.error('Error al guardar tema:', e);
            error.value = e.message;
            return false;

        } finally {
            loading.value = false;
        }
    }

    // Aplicar un tema guardado
    function applyTheme(theme) {
        if (theme) {
            currentTheme.value = { ...theme };
        }

        // Aplicar variables CSS al documento
        Object.entries(cssVars.value).forEach(([key, value]) => {
            document.documentElement.style.setProperty(key, value);
        });

        // Si hay usuario, guardar preferencia
        if (authStore.user?.uid) {
            saveUserThemePreference();
        }
    }

    // Guardar preferencia de tema del usuario
    async function saveUserThemePreference() {
        if (!authStore.user?.uid) return;

        try {
            const userThemeRef = doc(db, 'userThemes', authStore.user.uid);
            await setDoc(userThemeRef, {
                ...currentTheme.value,
                userId: authStore.user.uid,
                updatedAt: new Date()
            });

            console.log('Preferencia de tema del usuario guardada');

        } catch (e) {
            console.error('Error al guardar preferencia de tema:', e);
        }
    }

    // Restablecer al tema por defecto
    function resetToDefault() {
        currentTheme.value = { ...defaultTheme };
        applyTheme();
    }

    // Abrir el modal de temas
    function openThemeModal() {
        themeModalOpen.value = true;
    }

    // Cerrar el modal de temas
    function closeThemeModal() {
        themeModalOpen.value = false;
    }

    // Actualizar un color específico
    function updateColor(key, value) {
        if (key in currentTheme.value) {
            currentTheme.value[key] = value;
        }
    }

    // Observar cambios de autenticación para inicializar temas
    watch(() => authStore.isAuthenticated, (isAuthenticated) => {
        if (isAuthenticated) {
            init();
        } else {
            // Si cierra sesión, volver al tema por defecto
            resetToDefault();
        }
    }, { immediate: true });

    return {
        // Estado
        currentTheme,
        savedThemes,
        loading,
        error,
        themeModalOpen,
        // Getters
        primaryColor,
        secondaryColor,
        primaryColor2,
        secondaryColor2,
        accentColor,
        accentColor2,
        backgroundColor2,
        textColor2,
        backgroundColor,
        textColor,
        cssVars,
        // Acciones
        init,
        fetchSavedThemes,
        saveCurrentTheme,
        applyTheme,
        resetToDefault,
        openThemeModal,
        closeThemeModal,
        updateColor

    };
});