<script setup>
import { ref } from 'vue'

const emit = defineEmits(['volver', 'cuenta-creada'])

const nombreUsuario = ref('')
const correoElectronico = ref('')
const clave = ref('')
const mensaje = ref('')
const tipoMensaje = ref('')
const cargando = ref(false)

function actualizarUsuario(event) {
    // Elimina espacios automáticamente mientras escribe
    nombreUsuario.value = event.target.value.replace(/\s/g, '')
}

async function crearCuenta() {
    mensaje.value = ''
    tipoMensaje.value = ''

    if (!nombreUsuario.value.trim() || !correoElectronico.value.trim() || !clave.value) {
        mensaje.value = 'Completa todos los campos.'
        tipoMensaje.value = 'error'
        return
    }

    // Validar longitud del nombre de usuario
    if (nombreUsuario.value.length < 8 || nombreUsuario.value.length > 10) {
        mensaje.value = 'El nombre de usuario debe tener entre 8 y 10 caracteres.'
        tipoMensaje.value = 'error'
        return
    }

    // Validar que no tenga espacios
    if (/\s/.test(nombreUsuario.value)) {
        mensaje.value = 'El nombre de usuario no puede contener espacios.'
        tipoMensaje.value = 'error'
        return
    }

    cargando.value = true

    try {
        const respuesta = await fetch('/crear-cuenta', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                Nombre_usuario: nombreUsuario.value.trim(),
                Correo_electronico: correoElectronico.value.trim(),
                Clave: clave.value
            })
        })

        const datos = await respuesta.json()

        if (!respuesta.ok) {
            mensaje.value = datos.mensaje || 'No se pudo crear la cuenta.'
            tipoMensaje.value = 'error'
            return
        }

        mensaje.value = 'Cuenta creada correctamente.'
        tipoMensaje.value = 'exito'

        nombreUsuario.value = ''
        correoElectronico.value = ''
        clave.value = ''

        emit('cuenta-creada', datos)

    } catch (error) {
        console.error('Error al crear cuenta:', error)
        mensaje.value = 'No se pudo conectar con el servidor.'
        tipoMensaje.value = 'error'

    } finally {
        cargando.value = false
    }
}

function volverLogin() {
    emit('volver')
}
</script>

<template>
    <div class="ventana-navegador pantalla-crear-cuenta">

        <div class="barra-superior">
            <span class="puntito"></span>
            <span class="puntito"></span>
            <span class="puntito"></span>
        </div>

        <div class="contenedor-formulario">

            <h2>Crear cuenta</h2>

            <form class="formulario-cuenta" @submit.prevent="crearCuenta">

                <div class="campo">
                    <label for="nombreUsuario">Nombre de usuario</label>

                    <input
                        id="nombreUsuario"
                        :value="nombreUsuario"
                        @input="actualizarUsuario"
                        type="text"
                        minlength="8"
                        maxlength="10"
                        autocomplete="username"
                        required
                    >
                </div>

                <div class="campo">
                    <label for="correoElectronico">Correo electrónico</label>

                    <input
                        id="correoElectronico"
                        v-model="correoElectronico"
                        type="email"
                        autocomplete="email"
                        required
                    >
                </div>

                <div class="campo">
                    <label for="clave">Clave</label>

                    <input
                        id="clave"
                        v-model="clave"
                        type="password"
                        autocomplete="new-password"
                        required
                    >
                </div>

                <p
                    v-if="mensaje"
                    class="mensaje-tarjeta"
                    :class="{
                        'mensaje-error': tipoMensaje === 'error',
                        'mensaje-exito': tipoMensaje === 'exito'
                    }"
                >
                    {{ mensaje }}
                </p>

                <div class="botones-formulario">
                    <button type="button" @click="volverLogin">
                        Volver
                    </button>

                    <button type="submit" :disabled="cargando">
                        {{ cargando ? 'Creando...' : 'Crear cuenta' }}
                    </button>
                </div>

            </form>
        </div>
    </div>
</template>