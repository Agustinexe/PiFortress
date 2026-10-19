<script setup>
import { ref } from 'vue'

const emit = defineEmits([
    'volver',
    'tarjeta-cargada',
    'panel-principal'
])

const uidTarjeta = ref('')
const mensaje = ref('')
const tipoMensaje = ref('')
const cargando = ref(false)

async function cargarTarjeta() {
    mensaje.value = ''
    tipoMensaje.value = ''

    const uid = uidTarjeta.value.trim()

    if (!uid) {
        mensaje.value =
            'Ingresá el UID de la tarjeta.'
        tipoMensaje.value = 'error'
        return
    }

    const sesionId =
        sessionStorage.getItem('sesionId')

    if (!sesionId) {
        mensaje.value =
            'La sesión no es válida.'
        tipoMensaje.value = 'error'
        return
    }

    cargando.value = true

    try {
        const respuesta = await fetch(
            '/usuarios/tarjetas',
            {
                method: 'POST',
                headers: {
                    'Content-Type':
                        'application/json',
                    'x-sesion-id':
                        sesionId
                },
                body: JSON.stringify({
                    Uid_tarjeta: uid
                })
            }
        )

        const datos =
            await respuesta.json()

        if (!respuesta.ok) {
            throw new Error(
                datos.error ||
                datos.mensaje ||
                'No se pudo cargar la tarjeta.'
            )
        }

        mensaje.value =
            datos.mensaje ||
            'Tarjeta cargada correctamente.'

        tipoMensaje.value = 'exito'

        uidTarjeta.value = ''

        emit('tarjeta-cargada')

    } catch (error) {
        console.error(
            'Error cargando tarjeta:',
            error
        )

        mensaje.value =
            error.message ||
            'No se pudo conectar con el servidor.'
        tipoMensaje.value = 'error'

    } finally {
        cargando.value = false
    }
}

function volver() {
    emit('volver')
}
</script>

<template>
    <div
        class="ventana-navegador pantalla-cargar-tarjeta"
    >
        <div class="barra-superior">
            <div class="puntito"></div>
            <div class="puntito"></div>
            <div class="puntito"></div>
        </div>

        <div class="contenedor-pantalla">
            <div class="encabezado-pantalla">
                <div>
                    <h2>
                        Cargar tarjeta
                    </h2>

                    <p>
                        Registrá el UID de una nueva
                        tarjeta en el sistema.
                    </p>
                </div>
            </div>

            <form
                class="formulario-tarjeta"
                @submit.prevent="cargarTarjeta"
            >
                <div class="campo">
                    <label for="uidTarjeta">
                        UID de la tarjeta
                    </label>

                    <input
                        id="uidTarjeta"
                        v-model="uidTarjeta"
                        type="text"
                        autocomplete="off"
                        placeholder="Ingresá el UID"
                        required
                        :disabled="cargando"
                    >
                </div>

                <p
                    v-if="mensaje"
                    class="mensaje-tarjeta"
                    :class="{
                        'mensaje-error':
                            tipoMensaje === 'error',
                        'mensaje-exito':
                            tipoMensaje === 'exito'
                    }"
                >
                    {{ mensaje }}
                </p>

                <div class="botones-formulario">
                    <button
                        class="btn-accion"
                        type="button"
                        @click="emit('panel-principal')"
                    >
                        Volver
                    </button>

                    <button
                        type="submit"
                        :disabled="cargando"
                    >
                        {{
                            cargando
                                ? 'Cargando...'
                                : 'Cargar tarjeta'
                        }}
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>