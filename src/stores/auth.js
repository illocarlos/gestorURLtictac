// src/stores/auth.js - Usando Firebase Auth con Custom Claims
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { auth } from '../config/firebase'
import {
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    onAuthStateChanged
} from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'

export const useAuthStore = defineStore('auth', () => {
    // Estado
    const user = ref(null)
    const loading = ref(true)
    const error = ref(null)
    const userClaims = ref(null)

    // Getters
    const isAuthenticated = computed(() => !!user.value)

    // Verificar si el usuario tiene acceso basado en claims de Firebase
    const isAuthorized = computed(() => {
        if (!user.value) return false;
        // Si el usuario tiene el claim 'access' con valor true, está autorizado
        return userClaims.value && userClaims.value.access === true;
    })

    // Acciones
    async function loginWithGoogle() {
        loading.value = true;
        error.value = null;

        const provider = new GoogleAuthProvider();

        try {
            const result = await signInWithPopup(auth, provider);
            user.value = result.user;

            // Verificar token para obtener claims
            await refreshUserClaims();

            // Verificar si el usuario está autorizado basado en claims
            if (!isAuthorized.value) {
                // Si no está autorizado, cerrar sesión y mostrar error
                await firebaseSignOut(auth);
                user.value = null;
                error.value = `No tienes autorización para acceder (${result.user.email}). 
                      Contacta con el administrador para solicitar acceso.`;
                return false;
            }

            return true;
        } catch (e) {
            console.error('Error al iniciar sesión con Google:', e);
            error.value = translateAuthError(e.code);
            return false;
        } finally {
            loading.value = false;
        }
    }

    // Función para actualizar claims del usuario
    async function refreshUserClaims() {
        if (!user.value) {
            userClaims.value = null;
            return;
        }

        try {
            // Forzar actualización del token para obtener los últimos claims
            await user.value.getIdToken(true);
            const idTokenResult = await user.value.getIdTokenResult();
            userClaims.value = idTokenResult.claims;
            console.log('Claims del usuario:', userClaims.value);
        } catch (e) {
            console.error('Error al obtener claims:', e);
            userClaims.value = null;
        }
    }

    // Función para solicitar acceso (opcional)
    async function requestAccess() {
        if (!user.value) return false;

        try {
            const functions = getFunctions();
            const requestAccessFn = httpsCallable(functions, 'requestAccess');
            await requestAccessFn();
            return true;
        } catch (e) {
            console.error('Error al solicitar acceso:', e);
            error.value = 'Error al enviar solicitud de acceso. Intenta de nuevo.';
            return false;
        }
    }

    async function logout() {
        loading.value = true;
        error.value = null;

        try {
            await firebaseSignOut(auth);
            user.value = null;
            userClaims.value = null;
            return true;
        } catch (e) {
            console.error('Error al cerrar sesión:', e);
            error.value = e.message;
            return false;
        } finally {
            loading.value = false;
        }
    }

    // Inicializar el estado de autenticación
    function init() {
        onAuthStateChanged(auth, async (currentUser) => {
            user.value = currentUser;

            if (currentUser) {
                // Obtener claims del usuario
                await refreshUserClaims();

                // Si hay un usuario pero no está autorizado, cerrar sesión
                if (!isAuthorized.value) {
                    firebaseSignOut(auth).then(() => {
                        user.value = null;
                        userClaims.value = null;
                        error.value = `No tienes autorización para acceder (${currentUser.email}). 
                          Contacta con el administrador para solicitar acceso.`;
                    });
                }
            } else {
                userClaims.value = null;
            }

            loading.value = false;
        });
    }

    // Función para traducir códigos de error de Firebase Auth
    function translateAuthError(errorCode) {
        const errorMessages = {
            'auth/popup-closed-by-user': 'Has cerrado la ventana de inicio de sesión.',
            'auth/cancelled-popup-request': 'Operación cancelada. Intenta de nuevo.',
            'auth/popup-blocked': 'El navegador ha bloqueado la ventana emergente. Permite ventanas emergentes para este sitio.',
            'auth/account-exists-with-different-credential': 'Ya existe una cuenta con este correo electrónico. Intenta con otro método de inicio de sesión.',
            'auth/auth-domain-config-required': 'Error de configuración. Contacta con el administrador.',
            'auth/operation-not-allowed': 'Este método de inicio de sesión no está habilitado. Contacta con el administrador.',
            'auth/timeout': 'La operación ha excedido el tiempo máximo. Intenta de nuevo.',
            'auth/network-request-failed': 'Error de conexión. Revisa tu internet.',
        };

        return errorMessages[errorCode] || 'Error de autenticación. Intenta de nuevo.';
    }

    return {
        // Estado
        user,
        loading,
        error,
        userClaims,
        // Getters
        isAuthenticated,
        isAuthorized,
        // Acciones
        loginWithGoogle,
        logout,
        init,
        requestAccess
    }
})