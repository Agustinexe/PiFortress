<script setup>
import { ref } from 'vue'
import logo from '../assets/P.png'

const props = defineProps({
    mensajePermiso: {
        type: String,
        default: ''
    },

    esAdministrador: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits([
    'registros',
    'estadisticas',
    'usuarios',
    'cargar-tarjeta',
    'asignar-tarjeta',
    'cerrar-sesion'
])

// =====================================================
// NAVEGACIÓN
// =====================================================

function abrirRegistros() {

    emit('registros')

}

function abrirEstadisticas() {

    emit('estadisticas')

}

function abrirUsuarios() {

    emit('usuarios')

}

function abrirCargarTarjeta() {

    emit('cargar-tarjeta')

}

function abrirAsignarTarjeta() {

    emit('asignar-tarjeta')

}

function cerrarSesion() {

    emit('cerrar-sesion')

}
</script>


<template>
    <div class="pantalla-panel-administrador">

        <!-- =========================================
        BARRA SUPERIOR
        ========================================= -->
        <div class="barra-superior">
            <span class="puntito"></span>
            <span class="puntito"></span>
            <span class="puntito"></span>

        </div>

        <!-- =========================================
        LOGO
        ========================================= -->
        <div class="logo-panel">

            <img
                :src="logo"
                alt="PiFortress"
            >

        </div>

        <!-- =========================================
        CONTENIDO
        ========================================= -->
        <div class="contenedor-formulario panel-principal-contenido">

            <h2>
                Panel principal
            </h2>

            <p class="descripcion-panel">
                Selecciona una opción
            </p>

            <p
                v-if="props.mensajePermiso"
                class="mensaje-permiso-panel"
            >
                {{ props.mensajePermiso }}
            </p>

            <!-- =========================================
            REGISTROS DISPONIBLE PARA TODOS
            ========================================= -->
            <button
                class="boton-panel opcion-panel"
                type="button"
                @click="abrirRegistros"
            >

                <span class="viñeta-opcion viñeta-disponible">
                    •
                </span>

                <span>
                    Registros
                </span>

            </button>

            <!-- =========================================
            ESTADÍSTICAS DISPONIBLE PARA TODOS
            ========================================= -->
            <button
                class="boton-panel opcion-panel"
                type="button"
                @click="abrirEstadisticas"
            >

                <span class="viñeta-opcion viñeta-disponible">
                    •
                </span>

                <span>
                    Estadísticas
                </span>
            </button>

            <!-- =========================================
            USUARIOS
            ========================================= -->
            <button
                class="boton-panel opcion-panel"
                :class="{
                    'opcion-restringida':
                        !props.esAdministrador
                }"
                type="button"
                @click="abrirUsuarios"
            >

                <span
                    v-if="props.esAdministrador"
                    class="viñeta-opcion viñeta-disponible"
                >
                    •
                </span>

                <span
                    v-else
                    class="viñeta-opcion viñeta-restringida"
                    aria-hidden="true"
                >
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path d="M2 2l20 20" />
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                        <path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c5.2 0 9.3 4.3 10 8-.3 1.5-1.2 3-2.5 4.2" />
                        <path d="M6.2 6.2C4 7.5 2.5 9.8 2 12c.7 3.7 4.8 8 10 8 1.3 0 2.5-.3 3.6-.8" />
                    </svg>
                </span>

                <span>
                    Usuarios
                </span>
            </button>

            <!-- =========================================
            CARGAR TARJETAS
            ========================================= -->
            <button
                class="boton-panel opcion-panel"
                :class="{
                    'opcion-restringida':
                        !props.esAdministrador
                }"
                type="button"
                @click="abrirCargarTarjeta"
            >

                <span
                    v-if="props.esAdministrador"
                    class="viñeta-opcion viñeta-disponible"
                >
                    •
                </span>

                <span
                    v-else
                    class="viñeta-opcion viñeta-restringida"
                    aria-hidden="true"
                >
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path d="M2 2l20 20" />

                        <path
                            d="M10.6 10.6a2 2 0 0 0 2.8 2.8"
                        />

                        <path
                            d="M9.9 4.2A10.9 10.9 0 0 1 12 4c5.2 0 9.3 4.3 10 8-.3 1.5-1.2 3-2.5 4.2"
                        />

                        <path
                            d="M6.2 6.2C4 7.5 2.5 9.8 2 12c.7 3.7 4.8 8 10 8 1.3 0 2.5-.3 3.6-.8"
                        />
                    </svg>
                </span>

                <span>
                    Cargar tarjetas
                </span>
            </button>

            <!-- =========================================
            ASIGNAR TARJETA
            ========================================= -->
            <button
                class="boton-panel opcion-panel"
                :class="{
                    'opcion-restringida':
                        !props.esAdministrador
                }"
                type="button"
                @click="abrirAsignarTarjeta"
            >

                <span
                    v-if="props.esAdministrador"
                    class="viñeta-opcion viñeta-disponible"
                >
                    •
                </span>

                <span
                    v-else
                    class="viñeta-opcion viñeta-restringida"
                    aria-hidden="true"
                >
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path d="M2 2l20 20" />

                        <path
                            d="M10.6 10.6a2 2 0 0 0 2.8 2.8"
                        />

                        <path
                            d="M9.9 4.2A10.9 10.9 0 0 1 12 4c5.2 0 9.3 4.3 10 8-.3 1.5-1.2 3-2.5 4.2"
                        />

                        <path
                            d="M6.2 6.2C4 7.5 2.5 9.8 2 12c.7 3.7 4.8 8 10 8 1.3 0 2.5-.3 3.6-.8"
                        />
                    </svg>
                </span>

                <span>
                    Asignar tarjeta
                </span>
            </button>

            <!-- CERRAR SESIÓN -->
            <div class="contenedor-boton">
                <button
                    class="btn-accion"
                    type="button"
                    @click="cerrarSesion"
                >
                    Cerrar sesión
                </button>
            </div>
        </div>
    </div>
</template>