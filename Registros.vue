<script setup>
import {
    ref,
    computed,
    onMounted,
    onUnmounted,
    watch
} from 'vue'

const emit = defineEmits([
    'cerrar-sesion',
    'usuarios',
    'panel-principal'
])

const registros = ref([])
const cargando = ref(false)
const error = ref('')

const filtroFechaDesde = ref('')
const filtroFechaHasta = ref('')
const filtroUsuario = ref('')
const filtroCambios = ref('')

const usuarioActual = ref(null)

const inventario = ref([])
const cargandoInventario = ref(false)
const errorInventario = ref('')

const sesionId =
    sessionStorage.getItem('sesionId')

const usuarioGuardado =
    sessionStorage.getItem('usuarioActual')

if (usuarioGuardado) {
    try {
        usuarioActual.value =
            JSON.parse(usuarioGuardado)
    } catch (error) {
        console.error(
            'Error leyendo usuarioActual:',
            error
        )
    }
}

/* ========================================
   EDICIÓN DE CAMBIOS
======================================== */

const registroEditando = ref(null)
const textoCambioEditado = ref('')
const guardandoCambio = ref(false)
const errorEdicion = ref('')
const ahora = ref(Date.now())

let intervaloContador = null

const LIMITE_CAMBIO_MS = 5 * 60 * 1000

function obtenerFechaCambio(registro) {
    if (!registro.Fecha_modificacion_cambios) {
        return null
    }

    const fecha =
        new Date(
            registro.Fecha_modificacion_cambios
        )

    if (
        Number.isNaN(
            fecha.getTime()
        )
    ) {
        return null
    }

    return fecha
}

function milisegundosRestantes(registro) {
    const fechaCambio =
        obtenerFechaCambio(registro)

    if (!fechaCambio) {
        return 0
    }

    const limite =
        fechaCambio.getTime() +
        LIMITE_CAMBIO_MS

    return Math.max(
        0,
        limite - ahora.value
    )
}

function puedeEditarCambio(registro) {
    if (
        !registro.Cambios ||
        !registro.Fecha_modificacion_cambios
    ) {
        return false
    }

    return (
        milisegundosRestantes(registro) > 0
    )
}

function esPropietarioDelRegistro(registro) {
    if (!usuarioActual.value) {
        return false
    }

    return (
        Number(registro.Id_usuario) ===
        Number(usuarioActual.value.Id_usuario)
    )
}

function tiempoRestante(registro) {
    const milisegundos =
        milisegundosRestantes(registro)

    const segundosTotales =
        Math.ceil(
            milisegundos / 1000
        )

    const minutos =
        Math.floor(
            segundosTotales / 60
        )

    const segundos =
        segundosTotales % 60

    return `${minutos}:${String(
        segundos
    ).padStart(2, '0')}`
}

function comenzarEdicion(registro) {
    if (!puedeEditarCambio(registro)) {
        return
    }

    registroEditando.value =
        registro.id_registro

    textoCambioEditado.value =
        registro.Cambios || ''

    errorEdicion.value = ''
}

function cancelarEdicion() {
    registroEditando.value = null
    textoCambioEditado.value = ''
    errorEdicion.value = ''
}

async function guardarCambio(registro) {
    errorEdicion.value = ''

    if (
        !textoCambioEditado.value.trim()
    ) {
        errorEdicion.value =
            'El cambio no puede quedar vacío.'
        return
    }

    if (
        !puedeEditarCambio(registro)
    ) {
        errorEdicion.value =
            'El período de 5 minutos para modificar este cambio ya terminó.'

        cancelarEdicion()
        return
    }

    guardandoCambio.value = true

    try {
        const respuesta =
            await fetch(
                '/acceso-pendiente',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type':
                            'application/json',
                        'x-sesion-id':
                            sesionId || ''
                    },
                    body: JSON.stringify({
                        id_registro:
                            registro.id_registro,
                        cambios:
                            textoCambioEditado.value.trim()
                    })
                }
            )

        const datos =
            await respuesta.json()

        if (!respuesta.ok) {
            throw new Error(
                datos.error ||
                'No se pudo modificar el cambio.'
            )
        }

        /*
         * Actualizamos solamente el texto
         * del registro en pantalla.
         */
        registro.Cambios =
            textoCambioEditado.value.trim()

        cancelarEdicion()

    } catch (err) {
        console.error(
            '❌ Error modificando cambio:',
            err
        )

        errorEdicion.value =
            err.message ||
            'No se pudo modificar el cambio.'

    } finally {
        guardandoCambio.value = false
    }
}

/* ========================================
   ADMINISTRADOR
======================================== */

function esAdministrador() {
    const cargo =
        String(
            usuarioActual.value?.Cargo || ''
        )
            .trim()
            .toLowerCase()

    return (
        cargo === 'admin' ||
        cargo === 'administrador'
    )
}

/* ========================================
   CLASIFICACIÓN DE CAMBIOS
======================================== */

function clasificarCambio(texto) {
    const textoNormalizado =
        String(texto || '')
            .trim()
            .toLowerCase()

    if (!textoNormalizado) {
        return 'otro'
    }

    const palabrasIngreso =
        /\b(ingreso|ingresó|ingresaron|ingresar|ingresa|ingresan|agrego|agregó|agregaron|agregar|agrega|agregan|añado|añadió|añadieron|añadir|añade|añaden|guardo|guardó|guardaron|guardar|guarda|guardan|almaceno|almacenó|almacenaron|almacenar|almacena|almacenan)\b/

    const palabrasRetiro =
        /\b(retiro|retiró|retiraron|retirar|retira|retiran|saco|sacó|sacaron|sacar|saca|sacan|quito|quitó|quitaron|quitar|quita|quitan|extraigo|extrajo|extrajeron|extraer|extrae|extraen)\b/

    const palabrasControlCapital =
        /\b(control(?:es)?\s+de\s+capital|control(?:es)?\s+(?:de\s+)?(?:dinero|efectivo|fondos))\b/

    if (
        palabrasIngreso.test(
            textoNormalizado
        )
    ) {
        return 'ingreso'
    }

    if (
        palabrasRetiro.test(
            textoNormalizado
        )
    ) {
        return 'retiro'
    }

    if (
        palabrasControlCapital.test(
            textoNormalizado
        )
    ) {
        return 'control'
    }

    return 'otro'
}

/* ========================================
   USUARIOS DEL DESPLEGABLE
======================================== */

const usuariosDisponibles = computed(() => {
    const usuarios =
        registros.value
            .map(registro =>
                String(
                    registro.Nombre || ''
                ).trim()
            )
            .filter(Boolean)

    return [
        ...new Set(usuarios)
    ].sort((a, b) =>
        a.localeCompare(
            b,
            'es',
            {
                sensitivity: 'base'
            }
        )
    )
})

/* ========================================
   FILTROS DE REGISTROS
======================================== */

const registrosFiltrados = computed(() => {
    return registros.value.filter(
        registro => {

            if (
                filtroUsuario.value &&
                String(
                    registro.Nombre || ''
                ).trim() !==
                    filtroUsuario.value
            ) {
                return false
            }

            if (
                filtroCambios.value
            ) {
                const categoria =
                    clasificarCambio(
                        registro.Cambios
                    )

                if (
                    categoria !==
                    filtroCambios.value
                ) {
                    return false
                }
            }

            return true
        }
    )
})

/* ========================================
   CARGAR REGISTROS
======================================== */

async function cargarRegistros() {
    cargando.value = true
    error.value = ''

    try {
        const parametros =
            new URLSearchParams()

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

        const respuesta =
            await fetch(
                `/registros?${parametros.toString()}`,
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
            throw new Error(
                datos.error ||
                'No se pudieron cargar los registros'
            )
        }

        registros.value =
            Array.isArray(datos)
                ? datos
                : []

    } catch (err) {
        console.error(
            '❌ Error cargando registros:',
            err
        )

        error.value =
            err.message ||
            'No se pudieron cargar los registros'

        registros.value = []

    } finally {
        cargando.value = false
    }
}

/* ========================================
   CAMBIO AUTOMÁTICO DE FECHA
======================================== */

watch(
    [filtroFechaDesde, filtroFechaHasta],
    () => {
        cargarRegistros()
    }
)

/* ========================================
   INVENTARIO
======================================== */

async function cargarInventario() {
    cargandoInventario.value = true
    errorInventario.value = ''

    const sesionId =
        sessionStorage.getItem('sesionId')

    try {
        const respuesta =
            await fetch(
                '/inventario',
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
            throw new Error(
                datos.error ||
                'No se pudo cargar el inventario'
            )
        }

        inventario.value =
            Array.isArray(datos)
                ? datos
                : []

    } catch (error) {
        console.error(
            '❌ Error cargando inventario:',
            error
        )

        errorInventario.value =
            error.message ||
            'No se pudo cargar el inventario'

        inventario.value = []

    } finally {
        cargandoInventario.value = false
    }
}

/* ========================================
   FECHAS
======================================== */

function formatearFecha(fecha) {
    if (!fecha) {
        return '-'
    }

    const texto =
        String(fecha)

    if (
        texto.length >= 10 &&
        texto[4] === '-' &&
        texto[7] === '-'
    ) {
        const partes =
            texto
                .substring(0, 10)
                .split('-')

        return `${partes[2]}/${partes[1]}/${partes[0]}`
    }

    const fechaObjeto =
        new Date(fecha)

    if (
        Number.isNaN(
            fechaObjeto.getTime()
        )
    ) {
        return texto
    }

    return fechaObjeto.toLocaleDateString(
        'es-AR'
    )
}

/* ========================================
   NAVEGACIÓN
======================================== */

function abrirUsuarios() {
    if (!esAdministrador()) {
        alert(
            'No tenés permisos de administrador'
        )
        return
    }

    emit('usuarios')
}

function cerrarSesion() {
    emit('cerrar-sesion')
}

/* ========================================
   CONTADOR DE 5 MINUTOS
======================================== */

onMounted(() => {
    cargarRegistros()
    cargarInventario()

    intervaloContador =
        setInterval(() => {
            ahora.value = Date.now()
        }, 1000)
})

onUnmounted(() => {
    if (intervaloContador) {
        clearInterval(
            intervaloContador
        )
    }
})
</script>

<template>
    <div
        class="ventana-navegador pantalla-registros"
    >
        <div class="barra-superior">

            <div class="puntito"></div>
            <div class="puntito"></div>
            <div class="puntito"></div>

        </div>

        <div class="contenedor-pantalla">

            <!-- ENCABEZADO -->

            <div class="encabezado-pantalla">

                <div>
                    <h2>
                        Registros de acceso
                    </h2>
                </div>

                <div class="grupo-botones">

                    <button
                        class="btn-accion"
                        type="button"
                        @click="emit('panel-principal')"
                    >
                        Volver
                    </button>
                </div>
            </div>

            <!-- INVENTARIO -->
            <div class="resumen-inventario">

                <strong>
                    En la caja hay:
                </strong>

                <span
                    v-if="cargandoInventario"
                >
                    Cargando...
                </span>

                <span
                    v-else-if="errorInventario"
                    class="mensaje-error"
                >
                    {{ errorInventario }}
                </span>

                <span
                    v-else-if="
                        inventario.length === 0
                    "
                >
                    nada registrado
                </span>

                <span v-else>

                    <template
                        v-for="(
                            item,
                            indice
                        ) in inventario"
                        :key="
                            item.bien_almacenado
                        "
                    >

                        <span
                            v-if="
                                item.bien_almacenado
                                    .toLowerCase()
                                    === 'dinero'
                            "
                        >
                            ${{
                                Number(
                                    item.cantidad
                                ).toLocaleString(
                                    'es-AR'
                                )
                            }}
                        </span>

                        <span v-else>

                            {{
                                item.cantidad
                            }}

                            {{
                                item.bien_almacenado
                            }}

                            <span
                                v-if="
                                    Number(
                                        item.cantidad
                                    ) !== 1
                                "
                            >
                                s
                            </span>

                        </span>

                        <span
                            v-if="
                                indice <
                                inventario.length - 1
                            "
                        >
                            y
                        </span>

                    </template>

                </span>

            </div>

            <!-- FILTROS -->

            <div class="contenedor-filtros">

                <div class="campo">
                    <label for="filtro-fecha-desde">
                        Desde
                    </label>

                    <input
                        id="filtro-fecha-desde"
                        v-model="filtroFechaDesde"
                        type="date"
                    >

                </div>

                <div class="campo">

                    <label for="filtro-fecha-hasta">
                        Hasta
                    </label>

                    <input
                        id="filtro-fecha-hasta"
                        v-model="filtroFechaHasta"
                        type="date"
                    >

                </div>

                <div class="campo">
                    <label for="filtro-usuario">
                        Usuario
                    </label>

                    <select
                        id="filtro-usuario"
                        v-model="filtroUsuario"
                    >

                        <option value="">
                            Todos los usuarios
                        </option>

                        <option
                            v-for="
                                usuario in usuariosDisponibles
                            "
                            :key="usuario"
                            :value="usuario"
                        >
                            {{ usuario }}
                        </option>

                    </select>

                </div>

                <div class="campo">

                    <label for="filtro-cambios">
                        Cambios
                    </label>

                    <select
                        id="filtro-cambios"
                        v-model="filtroCambios"
                    >

                        <option value="">
                            Todos los cambios
                        </option>

                        <option value="ingreso">
                            Ingresos
                        </option>

                        <option value="retiro">
                            Retiros
                        </option>

                        <option value="control">
                            Controles de capital
                        </option>

                    </select>

                </div>

            </div>

            <!-- ESTADO DE CARGA -->

            <div
                v-if="cargando"
                class="mensaje-tarjeta"
            >
                Cargando registros...
            </div>

            <!-- ERROR -->

            <div
                v-if="error"
                class="
                    mensaje-tarjeta
                    mensaje-error
                "
            >
                {{ error }}
            </div>

            <!-- TABLA -->

            <div class="contenedor-tabla">

                <table class="tabla">

                    <thead>

                        <tr>

                            <th>
                                Usuario
                            </th>

                            <th>
                                Fecha
                            </th>

                            <th>
                                Apertura
                            </th>

                            <th>
                                Cierre
                            </th>

                            <th>
                                Cambios
                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        <tr
                            v-for="
                                registro in registrosFiltrados
                            "
                            :key="
                                registro.id_registro
                            "
                        >

                            <td>
                                {{
                                    registro.Nombre ||
                                    '-'
                                }}
                            </td>

                            <td>
                                {{
                                    formatearFecha(
                                        registro.Fecha
                                    )
                                }}
                            </td>

                            <td
                                class="
                                    hora-apertura
                                "
                            >
                                {{
                                    registro.Horario_apertura ||
                                    '-'
                                }}
                            </td>

                            <td
                                class="
                                    hora-cierre
                                "
                            >
                                {{
                                    registro.Horario_cierre ||
                                    '-'
                                }}
                            </td>

                            <td class="cambios">

                                <!-- MODO EDICIÓN -->
                                <div
                                    v-if="registroEditando === registro.id_registro"
                                    class="editor-cambio"
                                >

                                    <textarea
                                        v-model="textoCambioEditado"
                                        class="textarea-cambio"
                                        rows="2"
                                    ></textarea>

                                    <div class="botones-edicion">

                                        <span class="tiempo-edicion">
                                            {{ tiempoRestante(registro) }}
                                        </span>

                                        <button
                                            type="button"
                                            class="btn-guardar-cambio"
                                            :disabled="guardandoCambio"
                                            @click="guardarCambio(registro)"
                                        >
                                            {{ guardandoCambio ? 'Guardando...' : 'Guardar' }}
                                        </button>

                                        <button
                                            type="button"
                                            class="btn-cancelar-cambio"
                                            :disabled="guardandoCambio"
                                            @click="cancelarEdicion"
                                        >
                                            Cancelar
                                        </button>

                                    </div>

                                </div>

                                <!-- MODO NORMAL -->
                                <div
                                    v-else
                                    class="contenido-cambio"
                                >

                                    <span class="texto-cambio">
                                        {{ registro.Cambios || 'Pendiente' }}
                                    </span>

                                    <div
                                        v-if="registro.Cambios"
                                        class="acciones-cambio"
                                    >

                                        <span
                                            v-if="
                                                esPropietarioDelRegistro(registro) &&
                                                puedeEditarCambio(registro)
                                            "
                                            class="tiempo-edicion"
                                        >
                                            {{ tiempoRestante(registro) }}
                                        </span>

                                        <button
                                            v-if="
                                                esPropietarioDelRegistro(registro) &&
                                                puedeEditarCambio(registro)
                                            "
                                            type="button"
                                            class="btn-editar-cambio"
                                            @click="comenzarEdicion(registro)"
                                        >
                                            Editar
                                        </button>
                                    </div>
                                </div>
                            </td>
                        </tr>

                        <tr
                            v-if="
                                !cargando &&
                                registrosFiltrados.length === 0 &&
                                !error
                            "
                        >

                            <td
                                colspan="5"
                                class="centrado"
                            >
                                No se encontraron
                                registros.
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>