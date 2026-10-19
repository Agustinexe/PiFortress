<script setup>
import { ref, onMounted, watch } from 'vue'

// =====================================================
// EVENTOS
// =====================================================
const emit = defineEmits([
    'volver',
    'asignacion-completada',
    'panel-principal'
])

// =====================================================
// DATOS
// =====================================================
const usuarios = ref([])
const tarjetas = ref([])
const cargos = [
    'Administrador/a',
    'Gerente/a',
    'Vendedor/a',
    'Secretario/a'
]

// =====================================================
// SELECCIONES
// =====================================================
const usuarioSeleccionado =
    ref('')

const cargoSeleccionado =
    ref('')

const tarjetaSeleccionada =
    ref('')

// =====================================================
// ACTUALIZAR CARGO SEGÚN EL USUARIO
// =====================================================
watch(usuarioSeleccionado, (idUsuario) => {
    const usuario = usuarios.value.find(
        u => Number(u.Id_usuario) === Number(idUsuario)
    )

    cargoSeleccionado.value = usuario
        ? usuario.Cargo || ''
        : ''
})

// =====================================================
// ESTADO
// =====================================================
const mensaje =
    ref('')

const tipoMensaje =
    ref('')

const cargando =
    ref(false)

const cargandoDatos =
    ref(true)

// =====================================================
// CARGAR DATOS
// =====================================================

async function cargarDatos() {

    mensaje.value = ''
    tipoMensaje.value = ''
    cargandoDatos.value = true

    try {
        const sesionId =
            sessionStorage.getItem(
                'sesionId'
            )

        // =============================================
        // USUARIOS
        // =============================================
        const respuestaUsuarios =
            await fetch(
                '/usuarios',
                {
                    method: 'GET',

                    headers: {
                        'x-sesion-id':
                            sesionId || ''
                    }
                }
            )


        const datosUsuarios =
            await respuestaUsuarios.json()


        if (!respuestaUsuarios.ok) {
            throw new Error(
                datosUsuarios.error ||
                'No se pudieron cargar los usuarios'
            )
        }


        // Solo mostrar cuentas que todavía
        // no tienen cargo o tarjeta configurados
        usuarios.value = [
            ...new Map(
                datosUsuarios.map(usuario => [
                    Number(usuario.Id_usuario),
                    usuario
                ])
            ).values()
        ];

        // =============================================
        // TARJETAS DISPONIBLES
        // =============================================
        const respuestaTarjetas =
            await fetch(
                '/tarjetas-disponibles'
            )


        const datosTarjetas =
            await respuestaTarjetas.json()


        if (!respuestaTarjetas.ok) {
            throw new Error(
                datosTarjetas.mensaje ||
                'No se pudieron cargar las tarjetas'
            )

        }


        tarjetas.value =
            datosTarjetas

    } catch (error) {

        console.error(
            'Error cargando datos:',
            error
        )


        mensaje.value =
            error.message ||
            'No se pudieron cargar los datos.'


        tipoMensaje.value =
            'error'

    } finally {

        cargandoDatos.value =
            false

    }

}


// =====================================================
// ASIGNAR
// =====================================================
async function asignarConfiguracion() {

    mensaje.value = ''
    tipoMensaje.value = ''

    if (!usuarioSeleccionado.value) {

        mensaje.value =
            'Selecciona un usuario.'

        tipoMensaje.value =
            'error'

        return

    }


    if (!cargoSeleccionado.value) {

        mensaje.value =
            'Selecciona un cargo.'

        tipoMensaje.value =
            'error'

        return

    }


    if (!tarjetaSeleccionada.value) {

        mensaje.value =
            'Selecciona una tarjeta.'

        tipoMensaje.value =
            'error'

        return

    }


    cargando.value = true


    try {

        const sesionId =
            sessionStorage.getItem(
                'sesionId'
            )


        const respuesta =
            await fetch(
                '/asignar-tarjeta',
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json',

                        'x-sesion-id':
                            sesionId || ''
                    },

                    body: JSON.stringify({

                        Id_usuario:
                            Number(
                                usuarioSeleccionado.value
                            ),

                        Cargo:
                            cargoSeleccionado.value,

                        Uid_tarjeta:
                            tarjetaSeleccionada.value

                    })
                }
            )


        const datos =
            await respuesta.json()


        if (!respuesta.ok) {

            mensaje.value =
                datos.mensaje ||
                'No se pudo realizar la asignación.'

            tipoMensaje.value =
                'error'

            return

        }


        mensaje.value =
            'Usuario configurado correctamente.'

        tipoMensaje.value =
            'exito'


        // Limpiar selección

        usuarioSeleccionado.value =
            ''

        cargoSeleccionado.value =
            ''

        tarjetaSeleccionada.value =
            ''


        // Recargar usuarios y tarjetas

        await cargarDatos()


        emit(
            'asignacion-completada',
            datos
        )


    } catch (error) {

        console.error(
            'Error asignando configuración:',
            error
        )


        mensaje.value =
            'No se pudo conectar con el servidor.'

        tipoMensaje.value =
            'error'

    } finally {

        cargando.value =
            false
    }
}

// =====================================================
// INICIO
// =====================================================
onMounted(() => {
    cargarDatos()
})

// =====================================================
// VOLVER
// =====================================================
function volverPanel() {
    emit(
        'panel-principal'
    )
}
</script>

<template>
    <div
        class="
            ventana-navegador
            pantalla-asignar-tarjeta
        "
    >

        <!-- BARRA SUPERIOR -->
        <div class="barra-superior">
            <span class="puntito"></span>
            <span class="puntito"></span>
            <span class="puntito"></span>
        </div>

        <!-- CONTENIDO -->
        <div class="contenedor-formulario">
            <h2>
                Configurar usuario
            </h2>

            <p
                class="descripcion-asignar"
            >
                Asigna un cargo y una tarjeta RFID
            </p>


            <!-- CARGANDO -->
            <p
                v-if="cargandoDatos"
                class="mensaje-tarjeta"
            >
                Cargando datos...
            </p>

            <form
                v-else
                @submit.prevent="
                    asignarConfiguracion
                "
            >

                <!-- USUARIO -->
                <div class="campo">
                    <label for="usuario">
                        Usuario
                    </label>

                    <select
                        id="usuario"
                        v-model="
                            usuarioSeleccionado
                        "
                    >

                        <option
                            value=""
                            disabled
                        >
                            Seleccionar usuario
                        </option>

                        <option
                            v-for="
                                usuario in usuarios
                            "
                            :key="
                                usuario.Id_usuario
                            "
                            :value="
                                usuario.Id_usuario
                            "
                        >
                            {{
                                usuario.Nombre_usuario
                            }}
                        </option>
                    </select>
                </div>

                <!-- CARGO -->
                <div class="campo">
                    <label for="cargo">
                        Cargo
                    </label>

                    <select
                        id="cargo"
                        v-model="
                            cargoSeleccionado
                        "
                    >

                        <option
                            value=""
                            disabled
                        >
                            Seleccionar cargo
                        </option>

                        <option
                            v-for="
                                cargo in cargos
                            "
                            :key="cargo"
                            :value="cargo"
                        >
                            {{ cargo }}
                        </option>
                    </select>
                </div>

                <!-- TARJETA -->
                <div class="campo">
                    <label for="tarjeta">
                        Tarjeta RFID
                    </label>

                    <select
                        id="tarjeta"
                        v-model="
                            tarjetaSeleccionada
                        "
                    >

                        <option
                            value=""
                            disabled
                        >
                            Seleccionar tarjeta
                        </option>

                        <option
                            v-for="
                                tarjeta in tarjetas
                            "
                            :key="tarjeta.Uid_tarjeta"
                            :value="tarjeta.Uid_tarjeta"
                        >
                            {{
                                tarjeta.Uid_tarjeta
                            }}
                        </option>
                    </select>
                </div>

                <!-- MENSAJE -->
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

                <!-- BOTONES -->
                <div
                    class="
                        botones-formulario
                        botones-asignar
                    "
                >

                    <button
                        type="button"
                        @click="volverPanel"
                    >
                        Volver
                    </button>

                    <button
                        type="submit"
                        :disabled="cargando"
                    >
                        {{
                            cargando
                                ? 'Asignando...'
                                : 'Asignar'
                        }}
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>