// src/services/authService.js
import { auth } from '../firebase'; // Importando desde tu archivo firebase.js existente
import {
    GoogleAuthProvider,
    signInWithPopup,
    signOut as firebaseSignOut
} from 'firebase/auth';

// Proveedor de autenticación de Google
const googleProvider = new GoogleAuthProvider();

// Añadir scopes para solicitar más información del perfil (opcional)
// Por ejemplo, para acceder a la información básica del perfil de Google
googleProvider.addScope('profile');
googleProvider.addScope('email');

// Función para iniciar sesión con Google
export const signInWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);

        // Obtener información del usuario
        const user = result.user;

        // También puedes obtener el token de acceso de Google, que puede ser útil
        // para acceder a las APIs de Google en nombre del usuario
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential ? credential.accessToken : null;

        // Obtener información relevante del usuario
        const userData = {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            // Más datos disponibles
            emailVerified: user.emailVerified,
            phoneNumber: user.phoneNumber,
            // El token de acceso si lo necesitas
            accessToken: token
        };

        return { success: true, userData };
    } catch (error) {
        console.error('Error al iniciar sesión con Google:', error);
        return {
            success: false,
            error: error.message || 'Error desconocido al iniciar sesión',
            errorCode: error.code
        };
    }
};

// Función para cerrar sesión
export const signOut = async () => {
    try {
        await firebaseSignOut(auth);
        return { success: true };
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        return { success: false, error: error.message };
    }
};

// Función para obtener el usuario actual
export const getCurrentUser = () => {
    return auth.currentUser;
};

// Función para comprobar si el usuario ha iniciado sesión
export const isUserLoggedIn = () => {
    return !!auth.currentUser;
};

// Establecer observador de cambios en el estado de autenticación
export const onAuthStateChanged = (callback) => {
    return auth.onAuthStateChanged(callback);
};