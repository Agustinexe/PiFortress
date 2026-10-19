<script setup>
import { ref, onMounted, watch } from 'vue'

const emit = defineEmits([
    'panel-principal'
])

const estadisticas = ref([])
const cargando = ref(true)
const error = ref('')

const filtroFechaDesde = ref('')
const filtroFechaHasta = ref('')

let solicitudActual = 0

async function cargarEstadisticas() {
    const numeroSolicitud = ++solicitudActual

    cargando.value = true
    error.value = ''

    const sesionId =
        sessionStorage.getItem('sesionId')

    try {
        const parametros = new URLSearchParams()

        if (filtroFechaDesde.value) {
            parametros.append(
                'fechaDesde',
                filtroFechaDesde.value
            )
        }

        if (filtroFechaHasta.value) {
            parametros.append(
                'fechaHasta',
                filtroFechaHasta.value
            )
        }

        const respuesta = await fetch(
            `/estadisticas-accesos?${parametros.toString()}`,
            {
                method: 'GET',
                headers: {
                    'x-sesion-id': sesionId || ''
                }
            }
        )

        const datos = await respuesta.json()

        // Ignorar respuestas de solicitudes anteriores.
        if (numeroSolicitud !== solicitudActual) {
            return
        }

        if (!respuesta.ok) {
            throw new Error(
                datos.error ||
                'No se pudieron cargar las estadísticas'
            )
        }

        estadisticas.value = Array.isArray(datos)
            ? datos
            : []

    } catch (errorConexion) {
        if (numeroSolicitud !== solicitudActual) {
            return
        }

        console.error(
            '❌ Error cargando estadísticas:',
            errorConexion
        )

        error.value =
            errorConexion.message ||
            'No se pudo conectar con el servidor'

        estadisticas.value = []

    } finally {
        if (numeroSolicitud === solicitudActual) {
            cargando.value = false
        }
    }
}

watch(
    [filtroFechaDesde, filtroFechaHasta],
    () => {
        cargarEstadisticas()
    }
)

function volverAlPanel() {
    emit('panel-principal')
}

onMounted(() => {
    cargarEstadisticas()
})
</script>

<template>
    <div class="pantalla-estadisticas">

        <div class="barra-superior">
            <span class="puntito"></span>
            <span class="puntito"></span>
            <span class="puntito"></span>
        </div>

        <div class="contenedor-estadisticas">

            <h2>
                Estadísticas de accesos
            </h2>

            <p class="descripcion-estadisticas">
                Cantidad de veces que cada usuario
                accedió a la caja
            </p>

            <!-- FILTROS DE FECHA -->
            <div class="filtros-estadisticas">

                <div class="campo">
                    <label for="estadisticas-fecha-desde">
                        Desde
                    </label>

                    <input
                        id="estadisticas-fecha-desde"
                        v-model="filtroFechaDesde"
                        type="date"
                    >
                </div>

                <div class="campo">
                    <label for="estadisticas-fecha-hasta">
                        Hasta
                    </label>

                    <input
                        id="estadisticas-fecha-hasta"
                        v-model="filtroFechaHasta"
                        type="date"
                    >
                </div>

            </div>

            <div
                v-if="cargando"
                class="mensaje-estadisticas"
            >
                Cargando estadísticas...
            </div>

            <div
                v-else-if="error"
                class="mensaje-estadisticas mensaje-error-estadisticas"
            >
                {{ error }}
            </div>

            <div
                v-else-if="estadisticas.length === 0"
                class="mensaje-estadisticas"
            >
                No hay usuarios para mostrar.
            </div>

            <div
                v-else
                class="grafico-barras"
            >

                <div
                    v-for="usuario in estadisticas"
                    :key="usuario.Nombre"
                    class="barra-usuario"
                >

                    <div class="barra-dato">

                        <span class="nombre-usuario-grafico">
                            {{ usuario.Nombre }}
                        </span>

                        <span class="cantidad-accesos">
                            {{ usuario.Accesos }}
                        </span>

                    </div>

                    <div class="contenedor-barra">

                        <div
                            class="barra-acceso"
                            :style="{
                                width:
                                    (
                                        Math.max(
                                            Number(usuario.Accesos),
                                            0
                                        ) /
                                        Math.max(
                                            ...estadisticas.map(
                                                item =>
                                                    Number(item.Accesos)
                                            ),
                                            1
                                        )
                                    ) * 100 + '%'
                            }"
                        ></div>

                    </div>
                </div>
            </div>

            <button
                type="button"
                class="btn-volver-panel"
                @click="volverAlPanel"
            >
                VOLVER
            </button>
        </div>
    </div>
</template>