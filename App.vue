<script setup>
import { ref } from 'vue'

// =====================================================
// COMPONENTES
// =====================================================
import Login from './components/Login.vue'
import CrearCuenta from './components/CrearCuenta.vue'
import Registros from './components/Registros.vue'
import Usuarios from './components/Usuarios.vue'
import RegistroCambios from './components/RegistroCambios.vue'
import CargarTarjeta from './components/CargarTarjeta.vue'
import PanelPrincipal from './components/PanelPrincipal.vue'
import AsignarTarjeta from './components/AsignarTarjeta.vue'
import Estadisticas from './components/Estadisticas.vue'

// =====================================================
// ESTADO
// =====================================================
const pantallaActual = ref('login')
const usuarioActual = ref(null)
const registroPendiente = ref(null)
const mensajePermiso = ref('')

// =====================================================
// INICIAR SESIÓN
// =====================================================
async function iniciarSesion(datos) {

    usuarioActual.value =
        datos.usuario

    sessionStorage.setItem(
        'usuarioActual',
        JSON.stringify(datos.usuario)
    )

    sessionStorage.setItem(
        'sesionId',
        datos.sesionId
    )

    /*
     * Comprobamos primero si el usuario
     * tiene un acceso pendiente.
     *
     * Esto se aplica tanto a administradores
     * como a usuarios normales.
     */
    await comprobarAccesoPendiente()

    /*
     * Si existe un acceso pendiente,
     * comprobamos que la pantalla haya cambiado
     * a "cambios".
     */
    if (registroPendiente.value) {
        return
    }

    /*
     * Todos los usuarios llegan al
     * Panel Principal.
     */
    pantallaActual.value =
        'panelPrincipal'
}

function esAdministrador() {

    const cargoUsuario =
        usuarioActual.value?.Cargo ??
        usuarioActual.value?.cargo ??
        ''

    const cargoNormalizado =
        String(cargoUsuario)
            .trim()
            .toLowerCase()

    return (
        cargoNormalizado === 'admin' ||
        cargoNormalizado === 'administrador' ||
        cargoNormalizado === 'administrador/a'
    )
}

// =====================================================
// COMPROBAR ACCESO PENDIENTE
// =====================================================
async function comprobarAccesoPendiente() {
    const sesionId =
        sessionStorage.getItem(
            'sesionId'
        )

    try {
        const respuesta =
            await fetch(
                '/acceso-pendiente',
                {
                    method: 'GET',
                    headers: {
                        'x-sesion-id':
                            sesionId || ''
                    }
                }
            )

        const datos =
            await respuesta.json()
        if (!respuesta.ok) {
            console.error(
                'Error comprobando acceso pendiente:',
                datos
            )

            pantallaActual.value =
                'registros'

            return
        }

        if (datos.pendiente) {
            registroPendiente.value =
                datos.registro

            pantallaActual.value =
                'cambios'

            return
        }

        registroPendiente.value =
            null

        pantallaActual.value =
            'registros'

    } catch (error) {
        console.error(
            'Error conectando con /acceso-pendiente:',
            error
        )

        pantallaActual.value =
            'registros'
    }
}

// =====================================================
// CREAR CUENTA
// =====================================================
function irACrearCuenta() {
    pantallaActual.value = 'crearCuenta'
}

function volverAlLogin() {
    pantallaActual.value = 'login'
}


// =====================================================
// PANEL PRINCIPAL
// =====================================================
function abrirRegistros() {
    pantallaActual.value = 'registros'
}

function abrirEstadisticas() {
    pantallaActual.value = 'estadisticas'
}

function abrirUsuarios() {

    if (!esAdministrador()) {
        mostrarMensajePermiso()
        return
    }

    pantallaActual.value = 'usuarios'
}

function abrirCargarTarjeta() {

    if (!esAdministrador()) {
        mostrarMensajePermiso()
        return
    }

    pantallaActual.value = 'cargarTarjeta'
}

function abrirAsignarTarjeta() {

    if (!esAdministrador()) {
        mostrarMensajePermiso()
        return
    }

    pantallaActual.value = 'asignarTarjeta'
}

// =====================================================
// VOLVER
// =====================================================
function volverAUsuarios() {
    pantallaActual.value = 'usuarios'
}

// =====================================================
// CERRAR SESIÓN
// =====================================================
function cerrarSesion() {
    const sesionId =
        sessionStorage.getItem(
            'sesionId'
        )

    if (sesionId) {
        fetch(
            '/cerrar-sesion',
            {
                method: 'POST',
                headers: {
                    'x-sesion-id': sesionId
                }
            }
        )
        .catch(error => {
            console.error(
                'Error cerrando sesión:',
                error
            )
        })
    }

    sessionStorage.removeItem(
        'sesionId'
    )

    sessionStorage.removeItem(
        'usuarioActual'
    )

    usuarioActual.value =
        null

    registroPendiente.value =
        null

    pantallaActual.value =
        'login'
}

// =====================================================
// MENSAJE PARA EL SUARIO QUE ENTRA SIN PERMISO
// =====================================================
function mostrarMensajePermiso() {

    mensajePermiso.value =
        'No tenés permisos de administrador'

    setTimeout(() => {
        mensajePermiso.value = ''
    }, 3000)
}
</script>

<template>

    <!-- LOGIN -->
    <Login
        v-if="
            pantallaActual === 'login'
        "
        @login-exitoso="
            iniciarSesion
        "
        @crear-cuenta="
            irACrearCuenta
        "
    />

    <!-- CREAR CUENTA -->
    <CrearCuenta
        v-else-if="
            pantallaActual === 'crearCuenta'
        "
        @volver="
            volverAlLogin
        "
    />

    <!-- PANEL PRINCIPAL -->
    <PanelPrincipal
        v-else-if="
            pantallaActual ===
            'panelPrincipal'
        "
        :mensaje-permiso="
            mensajePermiso
        "
        :es-administrador="
            esAdministrador()
        "
        @registros="
            abrirRegistros
        "
        @estadisticas="
            abrirEstadisticas
        "
        @usuarios="
            abrirUsuarios
        "
        @cargar-tarjeta="
            abrirCargarTarjeta
        "
        @asignar-tarjeta="
            abrirAsignarTarjeta
        "
        @cerrar-sesion="
            cerrarSesion
        "
    />
    
    <!-- REGISTRO DE CAMBIOS -->
    <RegistroCambios
        v-else-if="
            pantallaActual === 'cambios'
        "
        :registro="
            registroPendiente
        "
        @cambio-guardado="
            registroPendiente = null;
            pantallaActual = 'registros'
        "
    />

    <!-- REGISTROS -->
    <Registros
        v-else-if="
            pantallaActual === 'registros'
        "
        @cerrar-sesion="cerrarSesion"
        @usuarios="abrirUsuarios"
        @panel-principal="
            pantallaActual = 'panelPrincipal'
        "
    />

    <!-- USUARIOS -->
    <Usuarios
        v-else-if="
            pantallaActual === 'usuarios'
        "
        @volver="
            pantallaActual = 'panelPrincipal'
        "
        @cargar-tarjeta="
            abrirCargarTarjeta
        "
        @panel-principal="
            pantallaActual = 'panelPrincipal'
        "
    />

    <!-- CARGAR TARJETA -->
    <CargarTarjeta
        v-else-if="
            pantallaActual === 'cargarTarjeta'
        "
        @volver="
            volverAUsuarios
        "
        @tarjeta-cargada="
            volverAUsuarios
        "
        @panel-principal="
            pantallaActual = 'panelPrincipal'
        "
    />

    <!-- ASIGNAR TARJETA -->
    <AsignarTarjeta
        v-else-if="
            pantallaActual === 'asignarTarjeta'
        "
        @panel-principal="
            pantallaActual = 'panelPrincipal'
        "
        @asignacion-completada="
            console.log('Asignación completada')
        "
    />

    <!-- ESTADISTICAS DE ACCESO -->
    <Estadisticas
        v-else-if="
            pantallaActual === 'estadisticas'
        "
        @panel-principal="
            pantallaActual = 'panelPrincipal'
        "
    />
</template>