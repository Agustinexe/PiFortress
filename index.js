const express = require('express');
const mysql = require('mysql2');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// <--CONEXIÓN CON MYSQL-->
const conexion = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'pifortress'
});

conexion.connect((error) => {
    if (error) {
        console.error('❌ Error conectando con MySQL:', error);
        return;
    }
    console.log('✅ Conectado a la base de datos pifortress');
});

// <--CONFIGURACIÓN DE EXPRESS-->
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));

// <--SESIONES-->
const sesiones = new Map();

// <--VERIFICAR USUARIO-->
app.post('/verificar', (req, res) => {

    const {
        Nombre_usuario,
        Clave
    } = req.body

    if (
        !Nombre_usuario ||
        !Clave
    ) {
        return res.status(400).json({
            mensaje:
            'Completa todos los campos.'
        });
    }
    
    if (/\s/.test(Nombre_usuario)) {
        return res.status(400).json({
            mensaje:
            'El usuario no puede contener espacios.'
        })
    }

    const sqlUsuario = `
        SELECT
            Id_usuario,
            Nombre_usuario,
            Correo_electronico,
            Clave,
            Cargo,
            Uid_tarjeta
        FROM usuarios
        WHERE
            Nombre_usuario = ?
            AND Clave = ?
        LIMIT 1
    `;

    conexion.query(
        sqlUsuario,
        [
            Nombre_usuario,
            Clave
        ],
        (error, resultados) => {
            if (error) {
                console.error(
                    '❌ Error buscando usuario:',
                    error
                );

                return res.status(500).json({
                    valido: false,
                    mensaje: 'Error interno del servidor'
                });
            }

            if (
                !resultados ||
                resultados.length === 0
            ) {
                return res.json({
                    valido: false,
                    mensaje: 'Alguno de los datos no coincide'
                });
            }

            const usuario = resultados[0];

            // VERIFICAR TARJETA
            const sqlDispositivo = `
                SELECT
                    Uid_tarjeta,
                    Id_usuario,
                    Habilitado
                FROM dispositivos
                WHERE
                    Uid_tarjeta = ?
                    AND Id_usuario = ?
                LIMIT 1
            `;

            conexion.query(
                sqlDispositivo,
                [
                    usuario.Uid_tarjeta,
                    usuario.Id_usuario
                ],
                (errorDispositivo, dispositivos) => {
                    if (errorDispositivo) {
                        console.error(
                            '❌ Error verificando tarjeta:',
                            errorDispositivo
                        );

                        return res.status(500).json({
                            valido: false,
                            mensaje: 'Error verificando la tarjeta'
                        });
                    }

                    if (
                        !dispositivos ||
                        dispositivos.length === 0
                    ) {

                        return res.json({
                            valido: false,
                            mensaje:
                                'La tarjeta no está registrada o no está asociada al usuario'
                        });

                    }

                    const dispositivo =
                        dispositivos[0];

                    // TARJETA DESHABILITADA
                    if (
                        dispositivo.Habilitado !== 'True'
                    ) {

                        return res.json({
                            valido: false,
                            mensaje: 'La tarjeta está deshabilitada'
                        });

                    }

                    // CREAR SESIÓN
                    const sesionId =
                        crypto.randomUUID();
                    sesiones.set(
                        sesionId,
                        {
                            Id_usuario:
                                usuario.Id_usuario,
                            Nombre_usuario:
                                usuario.Nombre_usuario,
                            Correo_electronico:
                                usuario.Correo_electronico,
                            Cargo:
                                usuario.Cargo,
                            Uid_tarjeta:
                                usuario.Uid_tarjeta
                        }
                    );
                    return res.json({
                        valido: true,
                        sesionId,
                        usuario: {
                            Id_usuario:
                                usuario.Id_usuario,
                            Nombre_usuario:
                                usuario.Nombre_usuario,
                            Correo_electronico:
                                usuario.Correo_electronico,
                            Cargo:
                                usuario.Cargo,
                            Uid_tarjeta:
                                usuario.Uid_tarjeta
                        }
                    });
                }
            );
        }
    );
});

// <--OBTENER ACCESO PENDIENTE DE DESCRIPCIÓN-->
app.get('/acceso-pendiente', (req, res) => {

    const sesionId =
        req.headers['x-sesion-id']

    if (!sesionId) {

        return res.status(401).json({
            error: 'Sesión no válida'
        })

    }

    const sesion =
        sesiones.get(sesionId)

    if (!sesion) {

        return res.status(401).json({
            error: 'Sesión expirada o no válida'
        })

    }

    const sql = `
        SELECT
            r.id_registro,
            r.Fecha,
            r.Horario_apertura,
            r.Horario_cierre,
            r.Uid_tarjeta
        FROM registro r
        INNER JOIN usuarios u
            ON r.Uid_tarjeta = u.Uid_tarjeta
        WHERE
            u.Id_usuario = ?
            AND (
                r.Cambios IS NULL
                OR TRIM(r.Cambios) = ''
            )
        ORDER BY
            r.id_registro DESC
        LIMIT 1
    `

    conexion.query(
        sql,
        [sesion.Id_usuario],
        (error, resultados) => {

            if (error) {

                console.error(
                    '❌ Error buscando acceso pendiente:',
                    error
                )

                return res.status(500).json({
                    error:
                        'No se pudo consultar el acceso pendiente'
                })

            }

            if (
                !resultados ||
                resultados.length === 0
            ) {

                return res.json({
                    pendiente: false
                })

            }

            return res.json({
                pendiente: true,
                registro: resultados[0]
            })

        }
    )

})

// <--ANALIZAR QUE CAMBIO SE REALIZO EN EL INVENTARIO-->
function analizarCambioInventario(texto) {

    const textoNormalizado =
        String(texto || '')
            .trim()
            .toLowerCase()

    if (!textoNormalizado) {
        return null
    }

    let movimiento = null

    /*
     * ==================================================
     * INGRESOS
     * ==================================================
     */

    const palabrasIngreso =
        /\b(ingreso|ingresó|ingresaron|ingresé|ingresaste|ingresar|ingresa|ingresan|agrego|agregó|agregaron|agregué|agregaste|agregar|agrega|agregan|añado|añadió|añadieron|añadí|añadiste|añadir|añade|añaden|guardo|guardó|guardaron|guardé|guardaste|guardar|guarda|guardan|almaceno|almacenó|almacenaron|almacené|almacenaste|almacenar|almacena|almacenan)\b/

    /*
     * ==================================================
     * RETIROS
     * ==================================================
     */

    const palabrasRetiro =
        /\b(retiro|retiró|retiraron|retiré|retiraste|retirar|retira|retiran|saco|sacó|sacaron|saqué|sacaste|sacar|saca|sacan|quito|quitó|quitaron|quité|quitaste|quitar|quita|quitan|extraigo|extrajo|extrajeron|extraje|extraí|extraer|extrae|extraen)\b/

    /*
     * ==================================================
     * DETERMINAR MOVIMIENTO
     * ==================================================
     */

    const esIngreso =
        palabrasIngreso.test(
            textoNormalizado
        )

    const esRetiro =
        palabrasRetiro.test(
            textoNormalizado
        )

    /*
     * Si aparecen palabras de ambos tipos,
     * no hacemos ningún movimiento para evitar
     * modificar incorrectamente el inventario.
     */

    if (esIngreso && esRetiro) {

        console.log(
            '⚠️ El cambio contiene palabras de ingreso y retiro:',
            texto
        )

        return null
    }

    if (esIngreso) {
        movimiento = 'ingreso'
    }

    if (esRetiro) {
        movimiento = 'retiro'
    }

    if (!movimiento) {

        console.log(
            'ℹ️ Cambio sin movimiento de inventario:',
            texto
        )

        return null
    }

    /*
     * ==================================================
     * DINERO
     * ==================================================
     */

    const dinero =
        textoNormalizado.match(
            /\$\s*([\d.,]+)/
        )

    if (dinero) {

        const cantidadTexto =
            dinero[1]
                .replace(/\./g, '')
                .replace(/,/g, '')

        const cantidad =
            parseInt(
                cantidadTexto,
                10
            )

        if (
            !Number.isNaN(cantidad) &&
            cantidad > 0
        ) {

            const movimientoDetectado = {
                bien: 'Dinero',
                cantidad:
                    movimiento === 'ingreso'
                        ? cantidad
                        : -cantidad
            }

            console.log(
                '💰 Movimiento detectado:',
                movimientoDetectado
            )

            return movimientoDetectado
        }
    }

    /*
     * ==================================================
     * CANTIDAD DE OBJETOS
     * ==================================================
     */

    let cantidad = 1

    const cantidadEncontrada =
        textoNormalizado.match(
            /\b(\d+)\b/
        )

    if (cantidadEncontrada) {

        cantidad =
            parseInt(
                cantidadEncontrada[1],
                10
            )

        if (
            Number.isNaN(cantidad) ||
            cantidad <= 0
        ) {
            cantidad = 1
        }
    }

    /*
     * ==================================================
     * OBTENER OBJETO
     * ==================================================
     */

    let objeto =
        textoNormalizado

            /*
             * Eliminamos números.
             */
            .replace(
                /\b\d+\b/g,
                ''
            )

            /*
             * Eliminamos palabras de movimiento.
             */
            .replace(
                /\b(ingreso|ingresó|ingresaron|ingresé|ingresaste|ingresar|ingresa|ingresan|agrego|agregó|agregaron|agregué|agregaste|agregar|agrega|agregan|añado|añadió|añadieron|añadí|añadiste|añadir|añade|añaden|guardo|guardó|guardaron|guardé|guardaste|guardar|guarda|guardan|almaceno|almacenó|almacenaron|almacené|almacenaste|almacenar|almacena|almacenan|retiro|retiró|retiraron|retiré|retiraste|retirar|retira|retiran|saco|sacó|sacaron|saqué|sacaste|sacar|saca|sacan|quito|quitó|quitaron|quité|quitaste|quitar|quita|quitan|extraigo|extrajo|extrajeron|extraje|extraí|extraer|extrae|extraen)\b/g,
                ''
            )

            /*
             * Eliminamos palabras auxiliares.
             */
            .replace(
                /\b(un|una|unos|unas|el|la|los|las|de|del|al|se|más|mas)\b/g,
                ''
            )

            /*
             * Eliminamos signos.
             */
            .replace(
                /[.,;:!?]/g,
                ''
            )

            /*
             * Normalizamos espacios.
             */
            .replace(
                /\s+/g,
                ' '
            )

            .trim()

    /*
     * ==================================================
     * VALIDAR OBJETO
     * ==================================================
     */

    if (!objeto) {

        console.log(
            '⚠️ Se detectó movimiento pero no se encontró objeto:',
            texto
        )

        return null
    }

    if (
        objeto.length < 2 ||
        objeto.length > 50
    ) {
        return null
    }

    /*
     * ==================================================
     * CONVERTIR PLURALES A SINGULAR
     * ==================================================
     *
     * Ejemplos:
     *
     * documentos -> documento
     * relojes    -> reloj
     * carpetas   -> carpeta
     */

    const palabrasObjeto =
        objeto.split(' ')

    const palabrasConvertidas =
        palabrasObjeto.map(
            palabra => {

                /*
                 * Ejemplo:
                 * relojes -> reloj
                 *
                 * Solo aplicamos esta conversión
                 * a palabras suficientemente largas.
                 */

                if (
                    palabra.length > 4 &&
                    palabra.endsWith('es')
                ) {
                    return palabra.slice(
                        0,
                        -2
                    )
                }

                /*
                 * Ejemplo:
                 * carpetas -> carpeta
                 */

                if (
                    palabra.length > 3 &&
                    palabra.endsWith('s') &&
                    !palabra.endsWith('ss')
                ) {
                    return palabra.slice(
                        0,
                        -1
                    )
                }

                return palabra
            }
        )

    objeto =
        palabrasConvertidas.join(' ')

    /*
     * Primera letra en mayúscula.
     */

    objeto =
        objeto.charAt(0).toUpperCase() +
        objeto.slice(1)

    /*
     * ==================================================
     * CREAR MOVIMIENTO
     * ==================================================
     */

    const movimientoDetectado = {

        bien: objeto,

        cantidad:
            movimiento === 'ingreso'
                ? cantidad
                : -cantidad
    }

    console.log(
        '📦 Movimiento de inventario detectado:',
        movimientoDetectado
    )

    return movimientoDetectado
}

// <--OBTENER EL MOVIMIENTO REALIZADO EN EL INEVTARIO-->
function obtenerMovimientoInventario(texto) {
    if (!texto || !String(texto).trim()) {
        return null
    }

    return analizarCambioInventario(
        String(texto).trim()
    )
}


function actualizarInventario(
    movimiento,
    conexionBase,
    callback
) {
    if (!movimiento) {
        return callback(null)
    }

    const bien = String(
        movimiento.bien
    ).trim()

    const cantidad = Number(
        movimiento.cantidad
    )

    if (
        !bien ||
        Number.isNaN(cantidad) ||
        cantidad === 0
    ) {
        return callback(null)
    }

    const sqlBuscar = `
        SELECT
            bien_almacenado,
            cantidad
        FROM inventario
        WHERE LOWER(bien_almacenado) = LOWER(?)
        LIMIT 1
    `

    conexionBase.query(
        sqlBuscar,
        [bien],
        (error, resultados) => {

            if (error) {
                return callback(error)
            }

            /*
             * EL BIEN TODAVÍA NO EXISTE
             */
            if (
                !resultados ||
                resultados.length === 0
            ) {

                if (cantidad < 0) {
                    return callback(
                        new Error(
                            `No hay suficiente ${bien} en el inventario`
                        )
                    )
                }

                const sqlInsertar = `
                    INSERT INTO inventario
                    (bien_almacenado, cantidad)
                    VALUES (?, ?)
                `

                return conexionBase.query(
                    sqlInsertar,
                    [bien, cantidad],
                    callback
                )
            }

            /*
             * EL BIEN YA EXISTE
             */

            const cantidadActual =
                Number(
                    resultados[0].cantidad
                ) || 0

            const nuevaCantidad =
                cantidadActual + cantidad

            /*
             * NO PERMITIMOS INVENTARIO NEGATIVO
             */
            if (nuevaCantidad < 0) {
                return callback(
                    new Error(
                        `No hay suficiente ${bien} en el inventario`
                    )
                )
            }

            const sqlActualizar = `
                UPDATE inventario
                SET cantidad = ?
                WHERE LOWER(bien_almacenado) = LOWER(?)
            `

            conexionBase.query(
                sqlActualizar,
                [
                    nuevaCantidad,
                    bien
                ],
                callback
            )
        }
    )
}

// <--GUARDAR DESCRIPCIÓN DEL CAMBIO-->
app.post('/acceso-pendiente', (req, res) => {

    const sesionId =
        req.headers['x-sesion-id']

    if (!sesionId) {
        return res.status(401).json({
            error: 'Sesión no válida'
        })
    }

    const sesion =
        sesiones.get(sesionId)

    if (!sesion) {
        return res.status(401).json({
            error: 'Sesión expirada o no válida'
        })
    }

    const {
        id_registro,
        cambios
    } = req.body

    if (
        !id_registro ||
        !cambios ||
        !String(cambios).trim()
    ) {
        return res.status(400).json({
            error:
                'Debes indicar qué cambio realizaste'
        })
    }

    const cambiosNuevos =
        String(cambios).trim()

    const movimientoPrueba =
        obtenerMovimientoInventario(cambiosNuevos)

    console.log('====================================')
    console.log('📝 CAMBIO RECIBIDO:', cambiosNuevos)
    console.log('📦 MOVIMIENTO DETECTADO:', movimientoPrueba)
    console.log('====================================')
    const sqlRegistro = `
        SELECT
            r.id_registro,
            r.Cambios,
            r.Fecha_modificacion_cambios,
            r.Uid_tarjeta
        FROM registro r
        INNER JOIN usuarios u
            ON r.Uid_tarjeta = u.Uid_tarjeta
        WHERE
            r.id_registro = ?
            AND u.Id_usuario = ?
        LIMIT 1
    `

    conexion.query(
        sqlRegistro,
        [
            id_registro,
            sesion.Id_usuario
        ],
        (error, resultados) => {

            if (error) {

                console.error(
                    '❌ Error consultando registro:',
                    error
                )

                return res.status(500).json({
                    error:
                        'No se pudo consultar el registro'
                })
            }

            if (
                !resultados ||
                resultados.length === 0
            ) {

                return res.status(404).json({
                    error:
                        'El registro no existe o no pertenece al usuario'
                })
            }

            const registro =
                resultados[0]

            /*
             * ==================================================
             * PRIMERA VEZ QUE SE COMPLETA "CAMBIOS"
             * ==================================================
             */

            if (
                registro.Cambios === null ||
                String(
                    registro.Cambios
                ).trim() === ''
            ) {

                const movimiento =
                    obtenerMovimientoInventario(
                        cambiosNuevos
                    )

                /*
                 * Si el texto contiene un movimiento
                 * de inventario, lo aplicamos.
                 */
                if (movimiento) {

                    actualizarInventario(
                        movimiento,
                        conexion,
                        (errorInventario) => {

                            if (errorInventario) {

                                console.error(
                                    '❌ Error actualizando inventario:',
                                    errorInventario
                                )

                                return res.status(400).json({
                                    error:
                                        errorInventario.message
                                })
                            }

                            guardarCambioInicial()
                        }
                    )

                } else {

                    /*
                     * El texto no representa un movimiento
                     * reconocible. Se guarda igualmente
                     * como cambio normal.
                     */
                    guardarCambioInicial()
                }

                function guardarCambioInicial() {

                    const sqlActualizar = `
                        UPDATE registro
                        SET
                            Cambios = ?,
                            Fecha_modificacion_cambios = NOW()
                        WHERE
                            id_registro = ?
                    `

                    conexion.query(
                        sqlActualizar,
                        [
                            cambiosNuevos,
                            id_registro
                        ],
                        (errorActualizar) => {

                            if (errorActualizar) {

                                console.error(
                                    '❌ Error guardando cambio:',
                                    errorActualizar
                                )

                                return res.status(500).json({
                                    error:
                                        'No se pudo guardar el cambio'
                                })
                            }

                            console.log(
                                '✅ Cambio registrado:',
                                id_registro
                            )

                            return res.json({
                                correcto: true,
                                mensaje:
                                    'Cambio registrado correctamente',
                                puedeModificar: true
                            })
                        }
                    )
                }

                return
            }

            /*
             * ==================================================
             * EL CAMBIO YA HABÍA SIDO COMPLETADO
             * ==================================================
             */

            if (
                !registro.Fecha_modificacion_cambios
            ) {

                return res.status(403).json({
                    error:
                        'Este registro ya fue completado y no puede modificarse'
                })
            }

            /*
             * ==================================================
             * COMPROBAR LOS 5 MINUTOS
             * ==================================================
             */

            const sqlTiempo = `
                SELECT
                    TIMESTAMPDIFF(
                        SECOND,
                        Fecha_modificacion_cambios,
                        NOW()
                    ) AS segundos_transcurridos
                FROM registro
                WHERE id_registro = ?
                LIMIT 1
            `

            conexion.query(
                sqlTiempo,
                [id_registro],
                (errorTiempo, resultadosTiempo) => {

                    if (errorTiempo) {

                        console.error(
                            '❌ Error comprobando tiempo:',
                            errorTiempo
                        )

                        return res.status(500).json({
                            error:
                                'No se pudo comprobar el tiempo disponible'
                        })
                    }

                    const segundosTranscurridos =
                        Number(
                            resultadosTiempo[0]
                                .segundos_transcurridos
                        )

                    const LIMITE_SEGUNDOS =
                        5 * 60

                    if (
                        segundosTranscurridos >
                        LIMITE_SEGUNDOS
                    ) {

                        return res.status(403).json({
                            error:
                                'El período de 5 minutos para modificar el cambio ya terminó',
                            puedeModificar: false
                        })
                    }

                    /*
                     * ==================================================
                     * EDITAR CAMBIO
                     * ==================================================
                     */

                    const movimientoAnterior =
                        obtenerMovimientoInventario(
                            registro.Cambios
                        )

                    const movimientoNuevo =
                        obtenerMovimientoInventario(
                            cambiosNuevos
                        )

                    /*
                     * Primero revertimos el movimiento anterior.
                     */
                    if (movimientoAnterior) {

                        const movimientoRevertido = {
                            bien:
                                movimientoAnterior.bien,

                            cantidad:
                                -Number(
                                    movimientoAnterior.cantidad
                                )
                        }

                        actualizarInventario(
                            movimientoRevertido,
                            conexion,
                            (errorRevertir) => {

                                if (errorRevertir) {

                                    console.error(
                                        '❌ Error revirtiendo movimiento anterior:',
                                        errorRevertir
                                    )

                                    return res.status(400).json({
                                        error:
                                            errorRevertir.message
                                    })
                                }

                                aplicarMovimientoNuevo()
                            }
                        )

                    } else {

                        aplicarMovimientoNuevo()
                    }

                    function aplicarMovimientoNuevo() {

                        /*
                         * Ahora aplicamos el movimiento
                         * correspondiente al nuevo texto.
                         */
                        if (movimientoNuevo) {

                            actualizarInventario(
                                movimientoNuevo,
                                conexion,
                                (errorNuevo) => {

                                    if (errorNuevo) {

                                        console.error(
                                            '❌ Error aplicando nuevo movimiento:',
                                            errorNuevo
                                        )

                                        return res.status(400).json({
                                            error:
                                                errorNuevo.message
                                        })
                                    }

                                    guardarModificacion()
                                }
                            )

                        } else {

                            guardarModificacion()
                        }
                    }

                    function guardarModificacion() {

                        const sqlModificar = `
                            UPDATE registro
                            SET Cambios = ?
                            WHERE id_registro = ?
                        `

                        conexion.query(
                            sqlModificar,
                            [
                                cambiosNuevos,
                                id_registro
                            ],
                            (errorModificar) => {

                                if (errorModificar) {

                                    console.error(
                                        '❌ Error modificando cambio:',
                                        errorModificar
                                    )

                                    return res.status(500).json({
                                        error:
                                            'No se pudo modificar el cambio'
                                    })
                                }

                                console.log(
                                    '✏️ Cambio modificado:',
                                    id_registro
                                )

                                return res.json({
                                    correcto: true,
                                    mensaje:
                                        'Cambio modificado correctamente',
                                    puedeModificar: true
                                })
                            }
                        )
                    }
                }
            )
        }
    )
})

//<--CONEXIÓN AL RFID-->
app.post('/rfid', (req, res) => {

    const {
        Uid_tarjeta
    } = req.body;

    if (!Uid_tarjeta) {

        return res.status(400).json({
            autorizado: false,
            error:
                'No se recibió el UID de la tarjeta'
        });

    }

    const uid =
        String(Uid_tarjeta)
            .trim()
            .toUpperCase();

    // BUSCAR USUARIO Y TARJETA
    const sqlUsuario = `
        SELECT
            u.Id_usuario,
            u.Nombre_usuario,
            u.Uid_tarjeta,
            d.Habilitado
        FROM usuarios u
        INNER JOIN dispositivos d
            ON u.Id_usuario = d.Id_usuario
            AND u.Uid_tarjeta = d.Uid_tarjeta
        WHERE
            u.Uid_tarjeta = ?
        LIMIT 1
    `;

    conexion.query(
        sqlUsuario,
        [uid],
        (error, resultados) => {

            if (error) {

                console.error(
                    '❌ Error verificando tarjeta RFID:',
                    error
                );

                return res.status(500).json({
                    autorizado: false,
                    error:
                        'Error interno del servidor'
                });

            }

            if (
                !resultados ||
                resultados.length === 0
            ) {

                return res.status(403).json({
                    autorizado: false,
                    error:
                        'La tarjeta no está registrada'
                });

            }

            const usuario =
                resultados[0];

            // TARJETA DESHABILITADA
            if (
                usuario.Habilitado !== 'True'
            ) {

                return res.status(403).json({
                    autorizado: false,
                    error:
                        'La tarjeta está deshabilitada'
                });

            }

            // BUSCAR SI LA CAJA ESTÁ ABIERTA
            const sqlAbierto = `
                SELECT
                    id_registro
                FROM registro
                WHERE
                    Uid_tarjeta = ?
                    AND Horario_cierre IS NULL
                ORDER BY
                    id_registro DESC
                LIMIT 1
            `;

            conexion.query(
                sqlAbierto,
                [uid],
                (errorAbierto, registrosAbiertos) => {

                    if (errorAbierto) {

                        console.error(
                            '❌ Error buscando acceso abierto:',
                            errorAbierto
                        );

                        return res.status(500).json({
                            autorizado: false,
                            error:
                                'No se pudo consultar el estado de la caja'
                        });

                    }

                    // NO HAY APERTURA -> ABRIR
                    if (
                        !registrosAbiertos ||
                        registrosAbiertos.length === 0
                    ) {

                        const sqlAbrir = `
                            INSERT INTO registro
                            (
                                Fecha,
                                Horario_apertura,
                                Horario_cierre,
                                Uid_tarjeta,
                                Cambios
                            )
                            VALUES
                            (
                                CURDATE(),
                                CURTIME(),
                                NULL,
                                ?,
                                NULL
                            )
                        `;

                        return conexion.query(
                            sqlAbrir,
                            [uid],
                            (errorInsertar, resultado) => {

                                if (errorInsertar) {

                                    console.error(
                                        '❌ Error registrando apertura:',
                                        errorInsertar
                                    );

                                    return res.status(500).json({
                                        autorizado: false,
                                        error:
                                            'No se pudo registrar la apertura'
                                    });

                                }

                                return res.json({

                                    autorizado: true,

                                    accion: 'apertura',

                                    id_registro:
                                        resultado.insertId,

                                    usuario:
                                        usuario.Nombre_usuario

                                });

                            }
                        );

                    }

                    // HAY APERTURA -> CERRAR
                    const idRegistro =
                        registrosAbiertos[0].id_registro;

                    const sqlCerrar = `
                        UPDATE registro
                        SET
                            Horario_cierre = CURTIME()
                        WHERE
                            id_registro = ?
                            AND Horario_cierre IS NULL
                    `;

                    conexion.query(
                        sqlCerrar,
                        [idRegistro],
                        (errorCerrar, resultadoCerrar) => {

                            if (errorCerrar) {

                                console.error(
                                    '❌ Error registrando cierre:',
                                    errorCerrar
                                );

                                return res.status(500).json({
                                    autorizado: false,
                                    error:
                                        'No se pudo registrar el cierre'
                                });

                            }

                            if (
                                resultadoCerrar.affectedRows === 0
                            ) {

                                return res.status(409).json({
                                    autorizado: false,
                                    error:
                                        'La apertura ya fue cerrada'
                                });

                            }

                            return res.json({

                                autorizado: true,

                                accion: 'cierre',

                                id_registro:
                                    idRegistro,

                                usuario:
                                    usuario.Nombre_usuario

                            });

                        }
                    );

                }
            );

        }
    );

});

// <--OBTENER REGISTROS-->
app.get('/registros', (req, res) => {

    const {
        dia,
        usuario,
        cambios
    } = req.query;

    let sql = `
        SELECT
            r.id_registro,
            u.Id_usuario AS Id_usuario,
            u.Nombre_usuario AS Nombre,
            r.Fecha,
            r.Horario_apertura,
            r.Horario_cierre,
            r.Cambios,
            r.Fecha_modificacion_cambios,
            r.Uid_tarjeta
        FROM registro r
        LEFT JOIN usuarios u
            ON r.Uid_tarjeta = u.Uid_tarjeta
        WHERE 1 = 1
    `;

    const parametros = [];

    // FILTRO POR FECHA
    if (dia) {

        sql += `
            AND r.Fecha = ?
        `;

        parametros.push(dia);

    }

    // FILTRO POR USUARIO
    if (usuario) {

        sql += `
            AND u.Nombre_usuario LIKE ?
        `;

        parametros.push(
            `%${usuario}%`
        );

    }

    // FILTRO POR CAMBIOS
    if (cambios) {

        sql += `
            AND r.Cambios LIKE ?
        `;

        parametros.push(
            `%${cambios}%`
        );

    }

    sql += `
        ORDER BY
            r.Fecha DESC,
            r.Horario_apertura DESC
    `;

    conexion.query(
        sql,
        parametros,
        (error, resultados) => {

            if (error) {

                console.error(
                    '❌ Error obteniendo registros:',
                    error
                );

                return res.status(500).json({
                    error:
                        'No se pudieron obtener los registros'
                });

            }

            return res.json(resultados);

        }
    );

});

// <--ESTADISTICA DE ACCESOS DE CADA USUARIO-->
app.get('/estadisticas-accesos', (req, res) => {

    const sesionId = req.headers['x-sesion-id']

    if (!sesionId) {
        return res.status(401).json({
            error: 'Sesión no válida'
        })
    }

    const sesion = sesiones.get(sesionId)

    if (!sesion) {
        return res.status(401).json({
            error: 'Sesión expirada o no válida'
        })
    }

    const sql = `
        SELECT
            u.Nombre_usuario AS Nombre,
            COUNT(r.id_registro) AS Accesos
        FROM usuarios u
        LEFT JOIN registro r
            ON r.Uid_tarjeta = u.Uid_tarjeta
        GROUP BY
            u.Id_usuario,
            u.Nombre_usuario
        ORDER BY
            Accesos DESC,
            u.Nombre_usuario ASC
    `

    conexion.query(sql, (error, resultados) => {

        if (error) {
            console.error(
                '❌ Error obteniendo estadísticas:',
                error
            )

            return res.status(500).json({
                error: 'Error obteniendo estadísticas'
            })
        }

        return res.json(
            resultados || []
        )
    })
})

// <--MOSTRAR EL INEVNTARIO-->
app.get('/inventario', (req, res) => {

    const sesionId =
        req.headers['x-sesion-id'];

    if (!sesionId) {

        return res.status(401).json({
            error: 'Sesión no válida'
        });

    }

    const sesion =
        sesiones.get(sesionId);

    if (!sesion) {

        return res.status(401).json({
            error:
                'Sesión expirada o no válida'
        });

    }

    const sql = `
        SELECT
            bien_almacenado,
            cantidad
        FROM inventario
        WHERE
            cantidad > 0
        ORDER BY
            bien_almacenado ASC
    `;

    conexion.query(
        sql,
        (error, resultados) => {

            if (error) {

                console.error(
                    '❌ Error obteniendo inventario:',
                    error
                );

                return res.status(500).json({
                    error:
                        'No se pudo consultar el inventario'
                });

            }

            return res.json(
                resultados || []
            );

        }
    );

});

// <--COMPROBAR ADMINISTRADOR-->
function obtenerAdministrador(req, res) {
    const sesionId =
        req.headers['x-sesion-id'];

    // =====================================================
    // COMPROBAR SESIÓN
    // =====================================================
    if (!sesionId) {
        res.status(401).json({
            error: 'Sesión no válida'
        });
        return null;
    }

    const sesion =
        sesiones.get(sesionId);

    if (!sesion) {
        res.status(401).json({
            error: 'Sesión expirada o no válida'
        });
        return null;
    }

    // =====================================================
    // COMPROBAR CARGO
    // =====================================================
    const cargo =
        String(sesion.Cargo || '')
            .trim()
            .toLowerCase();

    const esAdministrador =
        cargo === 'administrador' ||
        cargo === 'administrador/a';


    if (!esAdministrador) {

        res.status(403).json({
            error:
                'No tenés permisos de administrador'
        });

        return null;

    }


    // =====================================================
    // ADMINISTRADOR AUTORIZADO
    // =====================================================

    return sesion;

}

// <--TARJETAS DISPONIBLES-->
app.get('/tarjetas-disponibles', (req, res) => {

    const sql = `
        SELECT
            Uid_tarjeta
        FROM dispositivos
        WHERE
            Id_usuario IS NULL
        ORDER BY
            Uid_tarjeta
    `;

    conexion.query(
        sql,
        (error, resultados) => {

            if (error) {

                console.error(
                    '❌ Error obteniendo tarjetas:',
                    error
                );

                return res.status(500).json({
                    error:
                        'No se pudieron cargar las tarjetas'
                });

            }

            return res.json(resultados);

        }
    );

});

// <--CREAR CUENTA-->
app.post('/crear-cuenta', (req, res) => {
    const {
        Nombre_usuario,
        Correo_electronico,
        Clave
    } = req.body

    if (
        !Nombre_usuario ||
        !Correo_electronico ||
        Clave === undefined ||
        Clave === null
    ) {
        return res.status(400).json({
            correcto: false,
            mensaje: 'Todos los campos son obligatorios'
        })
    }

    const nombre = String(Nombre_usuario).trim()

    // No permitir espacios
    if (/\s/.test(String(Nombre_usuario))) {
        return res.status(400).json({
            correcto: false,
            mensaje: 'El nombre de usuario no puede contener espacios'
        })
    }

    // Entre 8 y 10 caracteres
    if (nombre.length < 8 || nombre.length > 10) {
        return res.status(400).json({
            correcto: false,
            mensaje: 'El nombre de usuario debe tener entre 8 y 10 caracteres'
        })
    }

    const sqlUsuario = `
        INSERT INTO usuarios
        (Nombre_usuario, Correo_electronico, Clave)
        VALUES (?, ?, ?)
    `

    conexion.query(
        sqlUsuario,
        [
            nombre,
            String(Correo_electronico).trim(),
            Clave
        ],
        (errorUsuario, resultadoUsuario) => {

            if (errorUsuario) {
                console.error('❌ Error creando usuario:', errorUsuario)

                if (errorUsuario.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({
                        correcto: false,
                        mensaje: 'El nombre de usuario o correo electrónico ya está registrado'
                    })
                }

                return res.status(500).json({
                    correcto: false,
                    mensaje: 'No se pudo crear la cuenta'
                })
            }

            const idUsuario = resultadoUsuario.insertId

            console.log('✅ Usuario creado:', nombre)

            return res.json({
                correcto: true,
                mensaje: 'Cuenta creada correctamente',
                Id_usuario: idUsuario
            })
        }
    )
})

// <--OBTENER USUARIOS-->
app.get('/usuarios', (req, res) => {
    const administrador =
        obtenerAdministrador(req, res);

    if (!administrador) {
        return;
    }

    const sql = `
        SELECT
            u.Id_usuario,
            u.Nombre_usuario,
            u.Cargo,
            u.Correo_electronico,
            u.Uid_tarjeta,
            d.Habilitado
        FROM usuarios u
        LEFT JOIN dispositivos d
            ON u.Id_usuario = d.Id_usuario
            AND u.Uid_tarjeta = d.Uid_tarjeta
        ORDER BY
            u.Nombre_usuario
    `;


    conexion.query(
        sql,
        (error, resultados) => {

            if (error) {

                console.error(
                    '❌ Error obteniendo usuarios:',
                    error
                );


                return res.status(500).json({
                    error:
                        'No se pudieron obtener los usuarios'
                });

            }


            return res.json(
                resultados
            );

        }
    );

});

// <--ASIGNACIÓN DE TARJETA-->
app.post('/asignar-tarjeta', (req, res) => {

    // COMPROBAR ADMINISTRADOR
    const administrador =
        obtenerAdministrador(req, res);

    if (!administrador) {
        return;
    }

    // DATOS RECIBIDOS
    const {
        Id_usuario,
        Cargo,
        Uid_tarjeta
    } = req.body;

    // VALIDAR DATOS
    if (
        !Id_usuario ||
        !Cargo ||
        !Uid_tarjeta
    ) {

        return res.status(400).json({
            correcto: false,
            mensaje:
                'Debes seleccionar un usuario, un cargo y una tarjeta'
        });
    }

    const uid =
        String(Uid_tarjeta)
            .trim()
            .toUpperCase();


    const cargosPermitidos = [
        'Administrador/a',
        'Gerente/a',
        'Vendedor/a',
        'Secretario/a'
    ];


    if (
        !cargosPermitidos.includes(Cargo)
    ) {

        return res.status(400).json({
            correcto: false,
            mensaje:
                'El cargo seleccionado no es válido'
        });

    }

    // COMPROBAR USUARIO
    const sqlUsuario = `
        SELECT
            Id_usuario,
            Nombre_usuario,
            Cargo,
            Uid_tarjeta
        FROM usuarios
        WHERE
            Id_usuario = ?
        LIMIT 1
    `;


    conexion.query(
        sqlUsuario,
        [Id_usuario],
        (errorUsuario, usuarios) => {

            if (errorUsuario) {

                console.error(
                    '❌ Error buscando usuario:',
                    errorUsuario
                );


                return res.status(500).json({
                    correcto: false,
                    mensaje:
                        'No se pudo verificar el usuario'
                });

            }


            if (
                !usuarios ||
                usuarios.length === 0
            ) {

                return res.status(404).json({
                    correcto: false,
                    mensaje:
                        'El usuario seleccionado no existe'
                });

            }


            const usuario =
                usuarios[0];

            // COMPROBAR QUE EL USUARIO NO TENGA YA TARJETA
            if (
                usuario.Uid_tarjeta &&
                String(
                    usuario.Uid_tarjeta
                ).trim() !== ''
            ) {

                return res.status(400).json({
                    correcto: false,
                    mensaje:
                        'Este usuario ya tiene una tarjeta asignada'
                });

            }

            // COMPROBAR TARJETA LIBRE
            const sqlTarjeta = `
                SELECT
                    Uid_tarjeta,
                    Id_usuario
                FROM dispositivos
                WHERE
                    Uid_tarjeta = ?
                LIMIT 1
            `;


            conexion.query(
                sqlTarjeta,
                [uid],
                (errorTarjeta, tarjetas) => {

                    if (errorTarjeta) {

                        console.error(
                            '❌ Error verificando tarjeta:',
                            errorTarjeta
                        );


                        return res.status(500).json({
                            correcto: false,
                            mensaje:
                                'No se pudo verificar la tarjeta'
                        });

                    }


                    if (
                        !tarjetas ||
                        tarjetas.length === 0
                    ) {

                        return res.status(404).json({
                            correcto: false,
                            mensaje:
                                'La tarjeta no existe'
                        });

                    }


                    const tarjeta =
                        tarjetas[0];

                    // LA TARJETA DEBE ESTAR LIBRE
                    if (
                        tarjeta.Id_usuario !== null
                    ) {

                        return res.status(400).json({
                            correcto: false,
                            mensaje:
                                'La tarjeta ya está asignada a otro usuario'
                        });

                    }

                    // ACTUALIZAR USUARIO
                    const sqlActualizarUsuario = `
                        UPDATE usuarios
                        SET
                            Cargo = ?,
                            Uid_tarjeta = ?
                        WHERE
                            Id_usuario = ?
                    `;


                    conexion.query(
                        sqlActualizarUsuario,
                        [
                            Cargo,
                            uid,
                            Id_usuario
                        ],
                        (errorActualizarUsuario) => {

                            if (errorActualizarUsuario) {

                                console.error(
                                    '❌ Error actualizando usuario:',
                                    errorActualizarUsuario
                                );


                                return res.status(500).json({
                                    correcto: false,
                                    mensaje:
                                        'No se pudo configurar el usuario'
                                });

                            }

                            // ASIGNAR TARJETA AL USUARIO
                            const sqlAsignarTarjeta = `
                                UPDATE dispositivos
                                SET
                                    Id_usuario = ?
                                WHERE
                                    Uid_tarjeta = ?
                                    AND Id_usuario IS NULL
                            `;


                            conexion.query(
                                sqlAsignarTarjeta,
                                [
                                    Id_usuario,
                                    uid
                                ],
                                (errorAsignar, resultadoAsignar) => {

                                    if (errorAsignar) {

                                        console.error(
                                            '❌ Error asignando tarjeta:',
                                            errorAsignar
                                        );

                                        // DESHACER CAMBIOS DEL USUARIO
                                        conexion.query(
                                            `
                                            UPDATE usuarios
                                            SET
                                                Cargo = NULL,
                                                Uid_tarjeta = NULL
                                            WHERE
                                                Id_usuario = ?
                                            `,
                                            [Id_usuario]
                                        );


                                        return res.status(500).json({
                                            correcto: false,
                                            mensaje:
                                                'No se pudo asignar la tarjeta'
                                        });

                                    }


                                    if (
                                        resultadoAsignar.affectedRows === 0
                                    ) {

                                        // DESHACER CAMBIOS DEL USUARIO
                                        conexion.query(
                                            `
                                            UPDATE usuarios
                                            SET
                                                Cargo = NULL,
                                                Uid_tarjeta = NULL
                                            WHERE
                                                Id_usuario = ?
                                            `,
                                            [Id_usuario]
                                        );


                                        return res.status(400).json({
                                            correcto: false,
                                            mensaje:
                                                'La tarjeta ya no está disponible'
                                        });

                                    }

                                    // ÉXITO
                                    console.log(
                                        '✅ Usuario configurado:',
                                        usuario.Nombre_usuario
                                    );


                                    console.log(
                                        '👤 Cargo:',
                                        Cargo
                                    );


                                    console.log(
                                        '🪪 Tarjeta asignada:',
                                        uid
                                    );


                                    return res.json({

                                        correcto: true,

                                        mensaje:
                                            'Usuario configurado correctamente',

                                        Id_usuario:
                                            Id_usuario,

                                        Cargo:
                                            Cargo,

                                        Uid_tarjeta:
                                            uid
                                    });
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

// <--CAMBIAR ESTADO DE TARJETA-->
app.post('/usuarios/:uid/tarjeta', (req, res) => {

    const administrador =
        obtenerAdministrador(req, res);

    if (!administrador) {
        return;
    }

    const uid =
        String(req.params.uid)
            .trim()
            .toUpperCase();

    const {
        habilitado
    } = req.body;

    if (
        typeof habilitado !== 'boolean'
    ) {

        return res.status(400).json({
            error:
                'El estado de la tarjeta no es válido'
        });

    }

    const nuevoEstado =
        habilitado
            ? 'True'
            : 'False';

    const sql = `
        UPDATE dispositivos
        SET
            Habilitado = ?
        WHERE
            Uid_tarjeta = ?
    `;

    conexion.query(
        sql,
        [
            nuevoEstado,
            uid
        ],
        (error, resultado) => {

            if (error) {

                console.error(
                    '❌ Error actualizando tarjeta:',
                    error
                );

                return res.status(500).json({
                    error:
                        'No se pudo actualizar la tarjeta'
                });

            }

            if (
                resultado.affectedRows === 0
            ) {

                return res.status(404).json({
                    error:
                        'No se encontró la tarjeta'
                });

            }

            return res.json({
                correcto: true,
                Habilitado:
                    nuevoEstado
            });
        }
    );
});

// <--CARGAR NUEVA TARJETA-->
app.post('/usuarios/tarjetas', (req, res) => {
    const administrador =
        obtenerAdministrador(req, res);

    if (!administrador) {
        return;
    }

    const {
        Uid_tarjeta
    } = req.body;

    if (
        !Uid_tarjeta ||
        String(Uid_tarjeta).trim() === ''
    ) {

        return res.status(400).json({
            error:
                'Debés ingresar el UID de la tarjeta'
        });

    }

    const uid =
        String(Uid_tarjeta)
            .trim()
            .toUpperCase();

    const sqlBuscar = `
        SELECT
            Uid_tarjeta
        FROM dispositivos
        WHERE
            Uid_tarjeta = ?
        LIMIT 1
    `;

    conexion.query(
        sqlBuscar,
        [uid],
        (errorBusqueda, resultados) => {

            if (errorBusqueda) {

                console.error(
                    '❌ Error comprobando tarjeta:',
                    errorBusqueda
                );

                return res.status(500).json({
                    error:
                        'No se pudo comprobar la tarjeta'
                });

            }

            if (
                resultados &&
                resultados.length > 0
            ) {

                return res.status(409).json({
                    error:
                        'Esta tarjeta ya está registrada'
                });

            }

            const sqlInsertar = `
                INSERT INTO dispositivos
                (
                    Uid_tarjeta
                )
                VALUES
                (
                    ?
                )
            `;

            conexion.query(
                sqlInsertar,
                [uid],
                (errorInsertar, resultado) => {

                    if (errorInsertar) {

                        console.error(
                            '❌ Error cargando tarjeta:',
                            errorInsertar
                        );

                        return res.status(500).json({
                            error:
                                'No se pudo cargar la nueva tarjeta'
                        });

                    }

                    console.log(
                        '✅ Nueva tarjeta cargada:',
                        uid
                    );

                    return res.json({

                        correcto: true,

                        mensaje:
                            'Tarjeta cargada correctamente',

                        Uid_tarjeta:
                            uid,

                        id:
                            resultado.insertId
                    });
                }
            );
        }
    );
});

// <--CERRAR SESIÓN-->
app.post('/cerrar-sesion', (req, res) => {
    const sesionId =
        req.headers['x-sesion-id'];
    if (sesionId) {
        sesiones.delete(
            sesionId
        );
    }
    return res.json({
        correcto: true
    });
});

// <--INICIAR SERVIDOR-->
app.listen(PORT, '0.0.0.0',
    () => {
        console.log('');
        console.log('======================================');
        console.log('PiFortress iniciado correctamente');
        console.log(`🌐 http://localhost:${PORT}`);
        console.log('======================================');
        console.log('');
    }
);
// Ejecutar "node index.js" para iniciar el servidor. Ejecutar "http://localhost:3000" o Crtl + C para apagarlo.