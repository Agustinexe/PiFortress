<script setup>
import { ref, onMounted } from 'vue'

const emit = defineEmits([
    'volver',
    'cargar-tarjeta',
    'panel-principal'
])

const usuarios = ref([])
const cargando = ref(false)
const error = ref('')
const guardandoCargo = ref(null)

const sesionId = sessionStorage.getItem('sesionId')

const cargos = [
    'Administrador/a',
    'Gerente/a',
    'Vendedor/a',
    'Secretario/a'
]

// =====================================================
// CARGAR USUARIOS
// =====================================================

async function cargarUsuarios() {
    cargando.value = true
    error.value = ''

    try {
        const respuesta = await fetch('/usuarios', {
            method: 'GET',
            headers: {
                'x-sesion-id': sesionId || ''
            }
        })

        const datos = await respuesta.json()

        if (!respuesta.ok) {
            throw new Error(
                datos.error ||
                datos.mensaje ||
                'No se pudieron cargar los usuarios.'
            )
        }

        usuarios.value = Array.isArray(datos)
            ? datos.map(usuario => ({
                ...usuario,
                CargoSeleccionado: usuario.Cargo || ''
            }))
            : []

    } catch (err) {
        console.error('Error cargando usuarios:', err)

        error.value = err.message ||
            'No se pudieron cargar los usuarios.'

        usuarios.value = []
    } finally {
        cargando.value = false
    }
}

// =====================================================
// COMPROBAR ESTADO DE TARJETA
// =====================================================

function tarjetaHabilitada(usuario) {
    return String(usuario.Habilitado || '')
        .trim()
        .toLowerCase() === 'true'
}

// =====================================================
// CAMBIAR ESTADO DE TARJETA
// =====================================================

async function cambiarEstadoTarjeta(usuario) {
    if (!usuario.Uid_tarjeta) {
        return
    }

    const nuevoEstado = !tarjetaHabilitada(usuario)

    try {
        const respuesta = await fetch(
            `/usuarios/${encodeURIComponent(usuario.Uid_tarjeta)}/tarjeta`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-sesion-id': sesionId || ''
                },
                body: JSON.stringify({
                    habilitado: nuevoEstado
                })
            }
        )

        const datos = await respuesta.json()

        if (!respuesta.ok) {
            throw new Error(
                datos.error ||
                datos.mensaje ||
                'No se pudo cambiar el estado de la tarjeta.'
            )
        }

        usuario.Habilitado = nuevoEstado ? 'True' : 'False'

    } catch (err) {
        console.error('Error cambiando estado de tarjeta:', err)

        alert(
            err.message ||
            'No se pudo cambiar el estado de la tarjeta.'
        )
    }
}

// =====================================================
// MODIFICAR CARGO
// =====================================================

async function cambiarCargo(usuario) {
    const cargoActual = usuario.Cargo

    if (!cargos.includes(usuario.CargoSeleccionado)) {
        alert('Seleccioná un cargo válido.')
        return
    }

    if (usuario.CargoSeleccionado === cargoActual) {
        alert('El usuario ya tiene ese cargo.')
        return
    }

    const confirmar = window.confirm(
        `¿Querés cambiar el cargo de ${usuario.Nombre_usuario} ` +
        `de "${cargoActual}" a "${usuario.CargoSeleccionado}"?`
    )

    if (!confirmar) {
        usuario.CargoSeleccionado = cargoActual || ''
        return
    }

    guardandoCargo.value = usuario.Id_usuario

    try {
        const respuesta = await fetch(
            `/usuarios/${encodeURIComponent(usuario.Id_usuario)}/cargo`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-sesion-id': sesionId || ''
                },
                body: JSON.stringify({
                    Cargo: usuario.CargoSeleccionado
                })
            }
        )

        const datos = await respuesta.json()

        if (!respuesta.ok) {
            throw new Error(
                datos.error ||
                datos.mensaje ||
                'No se pudo actualizar el cargo.'
            )
        }

        usuario.Cargo = datos.Cargo || usuario.CargoSeleccionado
        usuario.CargoSeleccionado = usuario.Cargo

        alert('Cargo actualizado correctamente.')

    } catch (err) {
        console.error('Error actualizando cargo:', err)

        usuario.CargoSeleccionado = cargoActual || ''

        alert(
            err.message ||
            'No se pudo actualizar el cargo.'
        )
    } finally {
        guardandoCargo.value = null
    }
}

// =====================================================
// NAVEGACIÓN
// =====================================================

function abrirCargarTarjeta() {
    emit('cargar-tarjeta')
}

function volver() {
    emit('volver')
}

// =====================================================
// CARGA INICIAL
// =====================================================

onMounted(() => {
    cargarUsuarios()
})
</script>

<template>
    <div class="ventana-navegador pantalla-usuarios">

        <div class="barra-superior">
            <div class="puntito"></div>
            <div class="puntito"></div>
            <div class="puntito"></div>
        </div>

        <div class="contenedor-pantalla">

            <div class="encabezado-pantalla">
                <div>
                    <h2>Usuarios</h2>
                    <p>Administración de usuarios y tarjetas.</p>
                </div>

                <div class="grupo-botones">
                    <button
                        type="button"
                        class="btn-accion"
                        @click="volver"
                    >
                        Volver
                    </button>
                </div>
            </div>

            <div
                v-if="error"
                class="mensaje-tarjeta mensaje-error"
            >
                {{ error }}
            </div>

            <div
                v-if="cargando"
                class="mensaje-tarjeta"
            >
                Cargando usuarios...
            </div>

            <div
                v-else
                class="contenedor-tabla usuarios"
            >
                <table class="tabla">
                    <thead>
                        <tr>
                            <th>Usuario</th>
                            <th>Correo electrónico</th>
                            <th>Cargo</th>
                            <th>UID de tarjeta</th>
                            <th>Estado</th>
                            <th>Acción</th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr
                            v-for="usuario in usuarios"
                            :key="
                                usuario.Uid_tarjeta ||
                                usuario.Id_usuario
                            "
                        >
                            <td>
                                {{ usuario.Nombre_usuario || '-' }}
                            </td>

                            <td>
                                {{ usuario.Correo_electronico || '-' }}
                            </td>

                            <!-- CARGO EDITABLE -->
                            <td class="cargo-usuario">
                                <select
                                    v-model="usuario.CargoSeleccionado"
                                    :disabled="
                                        guardandoCargo === usuario.Id_usuario
                                    "
                                    aria-label="Seleccionar cargo del usuario"
                                >
                                    <option
                                        v-for="cargo in cargos"
                                        :key="cargo"
                                        :value="cargo"
                                    >
                                        {{ cargo }}
                                    </option>
                                </select>

                                <button
                                    type="button"
                                    class="btn-cambiar-tarjeta"
                                    :disabled="
                                        guardandoCargo === usuario.Id_usuario ||
                                        usuario.CargoSeleccionado === usuario.Cargo
                                    "
                                    @click="cambiarCargo(usuario)"
                                >
                                    {{
                                        guardandoCargo === usuario.Id_usuario
                                            ? 'Guardando...'
                                            : 'Guardar cargo'
                                    }}
                                </button>
                            </td>

                            <!-- UID -->
                            <td class="uid-tarjeta">
                                <span v-if="usuario.Uid_tarjeta">
                                    {{ usuario.Uid_tarjeta }}
                                </span>

                                <span v-else class="sin-tarjeta">
                                    Sin tarjeta
                                </span>
                            </td>

                            <!-- ESTADO -->
                            <td class="estado-tarjeta">
                                <span v-if="tarjetaHabilitada(usuario)">
                                    Habilitada
                                </span>

                                <span v-else-if="usuario.Uid_tarjeta">
                                    Deshabilitada
                                </span>

                                <span v-else>
                                    Sin tarjeta
                                </span>
                            </td>

                            <!-- ACCIÓN SOBRE LA TARJETA -->
                            <td class="centrado">
                                <button
                                    v-if="usuario.Uid_tarjeta"
                                    type="button"
                                    class="btn-cambiar-tarjeta"
                                    @click="cambiarEstadoTarjeta(usuario)"
                                >
                                    {{
                                        tarjetaHabilitada(usuario)
                                            ? 'Deshabilitar'
                                            : 'Habilitar'
                                    }}
                                </button>

                                <span v-else class="sin-tarjeta">
                                    No disponible
                                </span>
                            </td>
                        </tr>

                        <tr
                            v-if="usuarios.length === 0 && !error"
                        >
                            <td colspan="6" class="centrado">
                                No hay usuarios registrados.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>