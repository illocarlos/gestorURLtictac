// functions/index.js - Cloud Functions para administrar acceso

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Función para establecer acceso a un usuario
exports.setUserAccess = functions.https.onCall(async (data, context) => {
    // Verificar que el solicitante es un admin
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'No autenticado');
    }

    // Verificar que el solicitante tiene permisos de admin
    const callerUid = context.auth.uid;
    const callerData = await admin.auth().getUser(callerUid);
    const callerClaims = callerData.customClaims || {};

    if (!callerClaims.admin) {
        throw new functions.https.HttpsError('permission-denied', 'Solo los administradores pueden gestionar permisos');
    }

    // Parámetros esperados: uid del usuario y estado de acceso (true/false)
    const { uid, hasAccess } = data;

    if (!uid) {
        throw new functions.https.HttpsError('invalid-argument', 'Se requiere un UID de usuario');
    }

    try {
        // Establecer claim de acceso para el usuario
        await admin.auth().setCustomUserClaims(uid, {
            access: hasAccess === true,
            updatedAt: new Date().toISOString()
        });

        return { success: true, message: `Acceso ${hasAccess ? 'otorgado' : 'revocado'} para el usuario` };
    } catch (error) {
        console.error('Error al establecer claims:', error);
        throw new functions.https.HttpsError('internal', 'Error al actualizar permisos', error);
    }
});

// Función para establecer un administrador (solo para el primer setup)
exports.setAdmin = functions.https.onCall(async (data, context) => {
    // Esta función debe protegerse adecuadamente en producción
    // Aquí asumimos que solo se ejecuta durante la configuración inicial

    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'No autenticado');
    }

    const { adminEmail } = data;

    if (!adminEmail) {
        throw new functions.https.HttpsError('invalid-argument', 'Se requiere un email de administrador');
    }

    try {
        // Buscar usuario por email
        const userRecord = await admin.auth().getUserByEmail(adminEmail);

        // Establecer claim de admin
        await admin.auth().setCustomUserClaims(userRecord.uid, {
            admin: true,
            access: true,
            updatedAt: new Date().toISOString()
        });

        return { success: true, message: `Usuario ${adminEmail} establecido como administrador` };
    } catch (error) {
        console.error('Error al establecer admin:', error);
        throw new functions.https.HttpsError('internal', 'Error al establecer administrador', error);
    }
});

// Función para solicitar acceso
exports.requestAccess = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'No autenticado');
    }

    const user = context.auth;

    try {
        // Guardar solicitud en Firestore
        await admin.firestore().collection('accessRequests').add({
            userId: user.uid,
            email: user.email,
            displayName: user.token.name || '',
            requestedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'pending'
        });

        // Opcionalmente, enviar notificación a los administradores
        // (mediante Firestore triggers o FCM)

        return { success: true, message: 'Solicitud de acceso enviada correctamente' };
    } catch (error) {
        console.error('Error al solicitar acceso:', error);
        throw new functions.https.HttpsError('internal', 'Error al enviar solicitud', error);
    }
});

// Función para listar usuarios y su estado de acceso (para panel de admin)
exports.listUsers = functions.https.onCall(async (data, context) => {
    // Verificar que el solicitante es un admin
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'No autenticado');
    }

    const callerUid = context.auth.uid;
    const callerData = await admin.auth().getUser(callerUid);
    const callerClaims = callerData.customClaims || {};

    if (!callerClaims.admin) {
        throw new functions.https.HttpsError('permission-denied', 'Solo los administradores pueden ver la lista de usuarios');
    }

    try {
        // Obtener todos los usuarios (limitados a 1000)
        const userRecords = await admin.auth().listUsers(1000);

        const users = userRecords.users.map(user => {
            const claims = user.customClaims || {};
            return {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                hasAccess: claims.access === true,
                isAdmin: claims.admin === true,
                lastSignIn: user.metadata.lastSignInTime
            };
        });

        return { users };
    } catch (error) {
        console.error('Error al listar usuarios:', error);
        throw new functions.https.HttpsError('internal', 'Error al obtener usuarios', error);
    }
});