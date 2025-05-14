// src/stores/auth.js - Versión corregida con autenticación automática por lista de correos
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { auth, db } from '../config/firebase'
import {
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    onAuthStateChanged
} from 'firebase/auth'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'

export const useAuthStore = defineStore('auth', () => {
    // Estado
    const user = ref(null)
    const loading = ref(true)
    const error = ref(null)
    const userClaims = ref(null)

    // Getters
    const isAuthenticated = computed(() => !!user.value)

    // Verificar si el usuario tiene acceso
    const isAuthorized = computed(() => {
        console.log("Verificando autorización con user:", user.value);
        console.log("Claims actuales:", userClaims.value);

        if (!user.value) return false;

        // Si el usuario ya tiene claims de acceso, está autorizado
        if (userClaims.value && userClaims.value.access === true) {
            console.log("Usuario autorizado por claims");
            return true;
        }

        // Para usuarios que inician sesión por primera vez, considerarlos autorizados
        // si su email está en la lista (lo verificaremos en init y loginWithGoogle)
        return true; // Importante: cambiado a true por defecto para usuarios autenticados
    })

    // Verificar si el email está en la lista de correos autorizados
    async function checkEmailInAllowedList(email) {
        console.log('Verificando email en lista permitida:', email);
        if (!email) {
            console.log('Email no proporcionado');
            return false;
        }

        try {
            // Asegurarse que db está disponible
            if (!db) {
                console.error('Error: db no está definido');
                return false;
            }

            // Buscar en la colección 'allowedEmails'
            const emailsRef = collection(db, 'allowedEmails');
            const q = query(emailsRef, where('email', '==', email));
            console.log('Consultando Firestore para email:', email);
            const querySnapshot = await getDocs(q);

            const isAllowed = !querySnapshot.empty;
            console.log('Resultado de verificación para', email, ':', isAllowed, 'Documentos encontrados:', querySnapshot.size);

            if (isAllowed) {
                querySnapshot.forEach(doc => {
                    console.log('Documento encontrado:', doc.id, '=>', doc.data());
                });
            }

            // Si encontramos el email, está permitido
            return isAllowed;
        } catch (error) {
            console.error('Error al verificar email en lista permitida:', error);
            console.error('Detalles del error:', error.code, error.message);
            return false;
        }
    }

    // Acciones
    async function loginWithGoogle() {
        console.log("Iniciando proceso de login con Google");
        loading.value = true;
        error.value = null;

        const provider = new GoogleAuthProvider();
        // Mejor configuración para el popup
        provider.setCustomParameters({
            prompt: 'select_account',
            login_hint: 'user@example.com'
        });

        try {
            console.log("Abriendo popup de Google");
            const result = await signInWithPopup(auth, provider);
            user.value = result.user;

            console.log("Login exitoso con Google:", result.user.email);

            // Obtener el email del usuario
            const userEmail = result.user.email;

            // Verificar si el email está en la lista de permitidos
            console.log("Verificando email en lista de permitidos");
            const isEmailAllowed = await checkEmailInAllowedList(userEmail);

            if (isEmailAllowed) {
                // Si el email está en la lista, consideramos al usuario como autorizado
                console.log(`Email ${userEmail} encontrado en la lista de permitidos. Acceso concedido.`);

                // Forzar actualización de la UI
                setTimeout(() => {
                    loading.value = false;
                    // Esta línea fuerza la actualización de computedProperties
                    user.value = { ...user.value };
                }, 100);

                return true;
            } else {
                console.log(`Email ${userEmail} NO encontrado en la lista. Verificando claims.`);
                // Si el email no está en la lista, verificamos los claims por si acaso
                await refreshUserClaims();

                // Si no tiene claims de acceso y no está en la lista, cerramos sesión
                if (!userClaims.value || userClaims.value.access !== true) {
                    console.log("Usuario sin acceso por claims ni por lista. Cerrando sesión.");
                    await firebaseSignOut(auth);
                    user.value = null;
                    error.value = `No tienes autorización para acceder (${userEmail}). 
                          Contacta con el administrador para solicitar acceso.`;
                    return false;
                }

                console.log("Usuario con acceso por claims. Permitiendo ingreso.");
                // Si tiene claims de acceso, permitimos el acceso
                return true;
            }
        } catch (e) {
            console.error('Error al iniciar sesión con Google:', e);
            console.error('Detalles del error:', e.code, e.message);
            error.value = translateAuthError(e.code);
            return false;
        } finally {
            loading.value = false;
        }
    }

    // Función para actualizar claims del usuario
    async function refreshUserClaims() {
        console.log("Actualizando claims del usuario");
        if (!user.value) {
            console.log("No hay usuario para actualizar claims");
            userClaims.value = null;
            return;
        }

        try {
            // Forzar actualización del token para obtener los últimos claims
            console.log("Obteniendo token actualizado");
            await user.value.getIdToken(true);
            const idTokenResult = await user.value.getIdTokenResult();
            userClaims.value = idTokenResult.claims;
            console.log('Claims del usuario actualizados:', userClaims.value);
        } catch (e) {
            console.error('Error al obtener claims:', e);
            console.error('Detalles del error:', e.code, e.message);
            userClaims.value = null;
        }
    }

    // Función para solicitar acceso (opcional)
    async function requestAccess() {
        console.log("Iniciando solicitud de acceso");
        if (!user.value) {
            console.log("No hay usuario para solicitar acceso");
            return false;
        }

        try {
            // Primero verificamos si el email ya está en la lista de permitidos
            console.log("Verificando si el email ya está en la lista antes de solicitar acceso");
            const isEmailAllowed = await checkEmailInAllowedList(user.value.email);

            if (isEmailAllowed) {
                // Si ya está en la lista, no necesita solicitar acceso
                console.log(`El email ${user.value.email} ya está en la lista de permitidos.`);
                return true;
            }

            // Si no está en la lista, procedemos con la solicitud normal
            console.log("Ejecutando Cloud Function para solicitar acceso");
            const functions = getFunctions();
            const requestAccessFn = httpsCallable(functions, 'requestAccess');
            await requestAccessFn();
            console.log("Solicitud de acceso enviada correctamente");
            return true;
        } catch (e) {
            console.error('Error al solicitar acceso:', e);
            console.error('Detalles del error:', e.code, e.message);
            error.value = 'Error al enviar solicitud de acceso. Intenta de nuevo.';
            return false;
        }
    }

    async function logout() {
        console.log("Iniciando proceso de logout");
        loading.value = true;
        error.value = null;

        try {
            await firebaseSignOut(auth);
            user.value = null;
            userClaims.value = null;
            console.log("Logout completado con éxito");
            return true;
        } catch (e) {
            console.error('Error al cerrar sesión:', e);
            console.error('Detalles del error:', e.code, e.message);
            error.value = e.message;
            return false;
        } finally {
            loading.value = false;
        }
    }

    // Inicializar el estado de autenticación
    function init() {
        console.log("Inicializando estado de autenticación");
        onAuthStateChanged(auth, async (currentUser) => {
            console.log("Auth state changed:", currentUser ? currentUser.email : "No user");
            user.value = currentUser;

            if (currentUser) {
                // Verificar si el email está en la lista de permitidos
                const isEmailAllowed = await checkEmailInAllowedList(currentUser.email);

                if (isEmailAllowed) {
                    // Si el email está permitido, concedemos acceso automáticamente
                    console.log(`Email ${currentUser.email} encontrado en la lista. Acceso automático.`);
                    loading.value = false;

                    // Esta línea es importante para forzar la actualización del estado
                    setTimeout(() => {
                        user.value = { ...currentUser };
                    }, 100);

                    return;
                }

                // Si no está en la lista, verificamos claims normalmente
                await refreshUserClaims();

                // Si hay un usuario pero no está autorizado por claims, cerrar sesión
                if (!userClaims.value || userClaims.value.access !== true) {
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
        requestAccess,
        checkEmailInAllowedList
    }
})