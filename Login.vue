<script setup>
import { ref } from 'vue'

const emit = defineEmits([
    'login-exitoso',
    'crear-cuenta'
])

const nombreUsuario = ref('')
const clave = ref('')

const mensaje = ref('')
const cargando = ref(false)

function actualizarUsuario(event) {
    nombreUsuario.value =
        event.target.value.replace(/\s/g, '')
}

async function iniciarSesion() {
    mensaje.value = ''

    if (
        !nombreUsuario.value ||
        !clave.value
    ) {
        mensaje.value =
            'Completa todos los campos.'
        return
    }

    cargando.value = true

    try {
        const respuesta =
            await fetch('/verificar', {
                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/json'
                },

                body: JSON.stringify({
                    Nombre_usuario:
                        nombreUsuario.value,
                    Clave:
                        clave.value
                })
            })

        const datos =
            await respuesta.json()

        if (!respuesta.ok) {
            mensaje.value =
                datos.mensaje ||
                'No se pudo iniciar sesión.'

            return
        }

        sessionStorage.setItem(
            'sesionId',
            datos.sesionId
        )

        sessionStorage.setItem(
            'usuarioActual',
            JSON.stringify(
                datos.usuario
            )
        )

        emit(
            'login-exitoso',
            datos
        )

    } catch (error) {
        console.error(
            'Error al iniciar sesión:',
            error
        )

        mensaje.value =
            'No se pudo conectar con el servidor.'

    } finally {
        cargando.value = false
    }
}

function irACrearCuenta() {
    emit('crear-cuenta')
}
</script>

<template>
    <div class="ventana-navegador">

        <div class="barra-superior">
            <span class="puntito"></span>
            <span class="puntito"></span>
            <span class="puntito"></span>
        </div>

        <div class="contenedor-formulario">

            <h1>
                PiFortress
            </h1>

            <p class="mensaje-bienvenido">
                Sistema de acceso
            </p>

            <form
                @submit.prevent="iniciarSesion"
            >

                <div class="campo">

                    <label for="nombreUsuario">
                        Usuario
                    </label>

                    <input
                        id="nombreUsuario"
                        :value="nombreUsuario"
                        @input="actualizarUsuario"
                        type="text"
                        autocomplete="username"
                        required
                    >

                </div>

                <div class="campo">

                    <label for="clave">
                        Clave
                    </label>

                    <input
                        id="clave"
                        v-model="clave"
                        type="password"
                        autocomplete="current-password"
                        required
                    >

                </div>

                <p
                    v-if="mensaje"
                    class="mensaje-tarjeta mensaje-error"
                >
                    {{ mensaje }}
                </p>

                <div
                    class="contenedor-botones-login"
                >

                    <button
                        type="button"
                        @click="irACrearCuenta"
                    >
                        Crear cuenta
                    </button>

                    <button
                        type="submit"
                        :disabled="cargando"
                    >
                        {{
                            cargando
                                ? 'Ingresando...'
                                : 'Ingresar'
                        }}
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>