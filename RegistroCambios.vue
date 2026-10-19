<script setup>
import { ref } from 'vue'

const props = defineProps({
    registro: {
        type: Object,
        required: true
    }
})

const emit = defineEmits([
    'cambio-guardado'
])

const descripcion = ref('')
const mensaje = ref('')
const cargando = ref(false)

function formatearFecha(fecha) {
    if (!fecha) {
        return '-'
    }

    const texto = String(fecha)

    if (
        texto.length >= 10 &&
        texto[4] === '-' &&
        texto[7] === '-'
    ) {
        const partes =
            texto.substring(0, 10).split('-')

        return `${partes[2]}/${partes[1]}/${partes[0]}`
    }

    const fechaObjeto = new Date(fecha)

    if (Number.isNaN(fechaObjeto.getTime())) {
        return texto
    }

    return fechaObjeto.toLocaleDateString('es-AR')
}

async function guardarCambio() {
    mensaje.value = ''

    const texto = descripcion.value.trim()

    if (!texto) {
        mensaje.value =
            'Describí qué retiraste, agregaste o modificaste.'
        return
    }

    const sesionId =
        sessionStorage.getItem('sesionId')

    if (!sesionId) {
        mensaje.value =
            'La sesión no es válida.'
        return
    }

    cargando.value = true

    try {
        const respuesta = await fetch(
            '/acceso-pendiente',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-sesion-id': sesionId
                },
                body: JSON.stringify({
                    id_registro:
                        props.registro.id_registro,
                    cambios: texto
                })
            }
        )

        const datos = await respuesta.json()

        if (!respuesta.ok) {
            mensaje.value =
                datos.mensaje ||
                datos.error ||
                'No se pudo guardar el cambio.'
            return
        }

        emit('cambio-guardado')

    } catch (error) {
        console.error(
            'Error guardando cambio:',
            error
        )

        mensaje.value =
            'No se pudo conectar con el servidor.'

    } finally {
        cargando.value = false
    }
}
</script>

<template>
    <div class="ventana-navegador pantalla-registro-cambios">

        <div class="barra-superior">
            <div class="puntito"></div>
            <div class="puntito"></div>
            <div class="puntito"></div>
        </div>

        <div class="contenedor-pantalla">

            <div class="encabezado-pantalla">
                <div>
                    <h2>
                        Registro de acceso
                    </h2>

                    <p class="descripcion-acceso">
                        Se detectó un acceso reciente
                        a la caja fuerte.
                    </p>
                </div>
            </div>

            <div class="informacion-acceso">

                <div class="dato-acceso">
                    <strong>Fecha:</strong>

                    <span>
                        {{
                            formatearFecha(
                                registro.Fecha
                            )
                        }}
                    </span>
                </div>

                <div class="dato-acceso">
                    <strong>
                        Hora de apertura:
                    </strong>

                    <span>
                        {{
                            registro.Horario_apertura ||
                            '-'
                        }}
                    </span>
                </div>

                <div class="dato-acceso">
                    <strong>
                        Hora de cierre:
                    </strong>

                    <span>
                        {{
                            registro.Horario_cierre ||
                            'Todavía abierta'
                        }}
                    </span>
                </div>

            </div>

            <form
                @submit.prevent="guardarCambio"
            >

                <div class="campo campo-descripcion">

                    <label for="descripcionCambio">
                        Describí qué retiraste,
                        agregaste o modificaste:
                    </label>

                    <textarea
                        id="descripcionCambio"
                        v-model="descripcion"
                        rows="6"
                        required
                        placeholder="Describí los cambios realizados..."
                        :disabled="cargando"
                    ></textarea>

                </div>

                <p
                    v-if="mensaje"
                    class="mensaje-tarjeta mensaje-error"
                >
                    {{ mensaje }}
                </p>

                <button
                    type="submit"
                    :disabled="cargando"
                >
                    {{
                        cargando
                            ? 'Guardando...'
                            : 'Guardar cambio'
                    }}
                </button>
            </form>
        </div>
    </div>
</template>