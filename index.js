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
        Correo_electronico,
        Clave
    } = req.body;

    if (
        !Nombre_usuario ||
        !Correo_electronico ||
        Clave === undefined ||
        Clave === null
    ) {

        return res.status(400).json({
            valido: false,
            mensaje: 'Todos los campos son obligatorios'
        });

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
            AND Correo_electronico = ?
            AND Clave = ?
        LIMIT 1
    `;

    conexion.query(
        sqlUsuario,
        [
            Nombre_usuario,
            Correo_electronico,
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

function analizarCambioInventario(texto) {

    const textoNormalizado =
        texto
            .trim()
            .toLowerCase();

    let movimiento = null;

    // INGRESOS
    const palabrasIngreso =
        /\b(ingreso|ingresó|ingresaron|ingresar|ingresa|ingresan|agrego|agregó|agregaron|agregar|agrega|agregan|añado|añadió|añadieron|añadir|añade|añaden|guardo|guardó|guardaron|guardar|guarda|guardan|almaceno|almacenó|almacenaron|almacenar|almacena|almacenan)\b/;

    // RETIROS
    const palabrasRetiro =
        /\b(retiro|retiró|retiraron|retirar|retira|retiran|saco|sacó|sacaron|sacar|saca|sacan|quito|quitó|quitaron|quitar|quita|quitan|extraigo|extrajo|extrajeron|extraer|extrae|extraen)\b/;

    if (palabrasIngreso.test(textoNormalizado)) {
        movimiento = 'ingreso';
    }

    if (palabrasRetiro.test(textoNormalizado)) {
        movimiento = 'retiro';
    }

    if (!movimiento) {
        console.log('ℹ️ Cambio sin movimiento de inventario:', texto);
        return null;
    }

    /*
     * -----------------------------------------
     * DINERO
     * -----------------------------------------
     */

    const dinero =
        textoNormalizado.match(/\$\s*([\d.,]+)/);

    if (dinero) {

        const cantidadTexto =
            dinero[1]
                .replace(/\./g, '')
                .replace(/,/g, '');

        const cantidad =
            parseInt(cantidadTexto, 10);

        if (!Number.isNaN(cantidad) && cantidad > 0) {

            const movimientoDetectado = {
                bien: 'Dinero',
                cantidad:
                    movimiento === 'ingreso'
                        ? cantidad
                        : -cantidad
            };

            console.log(
                '💰 Movimiento detectado:',
                movimientoDetectado
            );

            return movimientoDetectado;
        }
    }

    /*
     * -----------------------------------------
     * CANTIDAD DE OBJETOS
     * -----------------------------------------
     */

    let cantidad = 1;

    const cantidadEncontrada =
        textoNormalizado.match(/\b(\d+)\b/);

    if (cantidadEncontrada) {

        cantidad =
            parseInt(
                cantidadEncontrada[1],
                10
            );

        if (
            Number.isNaN(cantidad) ||
            cantidad <= 0
        ) {
            cantidad = 1;
        }
    }

    /*
     * -----------------------------------------
     * OBTENER OBJETO
     * -----------------------------------------
     */

    let objeto =
        textoNormalizado

            .replace(/\b\d+\b/g, '')

            .replace(
                /\b(ingreso|ingresó|ingresaron|ingresar|ingresa|ingresan|agrego|agregó|agregaron|agregar|agrega|agregan|añado|añadió|añadieron|añadir|añade|añaden|guardo|guardó|guardaron|guardar|guarda|guardan|almaceno|almacenó|almacenaron|almacenar|almacena|almacenan|retiro|retiró|retiraron|retirar|retira|retiran|saco|sacó|sacaron|sacar|saca|sacan|quito|quitó|quitaron|quitar|quita|quitan|extraigo|extrajo|extrajeron|extraer|extrae|extraen)\b/g,
                ''
            )

            .replace(
                /\b(un|una|unos|unas|el|la|los|las|de|del|al|se|más|mas)\b/g,
                ''
            )

            .replace(/[.,;:!?]/g, '')

            .replace(/\s+/g, ' ')

            .trim();

    if (!objeto) {
        console.log(
            '⚠️ Se detectó movimiento pero no se encontró objeto:',
            texto
        );
        return null;
    }

    if (
        objeto.length < 2 ||
        objeto.length > 50
    ) {
        return null;
    }

    /*
     * Convertimos algunos plurales simples
     * a singular para evitar:
     *
     * Reloj
     * Relojes
     *
     * como elementos separados.
     */

    if (objeto.endsWith('es')) {
        objeto = objeto.slice(0, -2);
    }
    else if (
        objeto.endsWith('s') &&
        !objeto.endsWith('ss')
    ) {
        objeto = objeto.slice(0, -1);
    }

    objeto =
        objeto.charAt(0).toUpperCase() +
        objeto.slice(1);

    const movimientoDetectado = {
        bien: objeto,
        cantidad:
            movimiento === 'ingreso'
                ? cantidad
                : -cantidad
    };

    console.log(
        '📦 Movimiento de inventario detectado:',
        movimientoDetectado
    );

    return movimientoDetectado;
}

// <--GUARDAR DESCRIPCIÓN DEL CAMBIO-->
app.post('/acceso-pendiente', (req, res) => {

    const sesionId =
        req.headers['x-sesion-id'];

    const {
        id_registro,
        cambios
    } = req.body;

    if (!sesionId) {

        return res.status(401).json({
            error: 'Sesión no válida'
        });

    }

    const sesion =
        sesiones.get(sesionId);

    if (!sesion) {

        return res.status(401).json({
            error: 'Sesión expirada o no válida'
        });

    }

    if (
        !id_registro ||
        typeof cambios !== 'string' ||
        !cambios.trim()
    ) {

        return res.status(400).json({
            error:
                'Debés completar la descripción del cambio'
        });

    }

    const sql = `
        UPDATE registro r
        INNER JOIN usuarios u
            ON r.Uid_tarjeta = u.Uid_tarjeta
        SET
            r.Cambios = ?
        WHERE
            r.id_registro = ?
            AND u.Id_usuario = ?
            AND (
                r.Cambios IS NULL
                OR TRIM(r.Cambios) = ''
            )
    `;

    conexion.query(
        sql,
        [
            cambios.trim(),
            id_registro,
            sesion.Id_usuario
        ],
        (error, resultado) => {

            if (error) {

                console.error(
                    '❌ Error guardando descripción:',
                    error
                );

                return res.status(500).json({
                    error:
                        'No se pudo guardar la descripción'
                });

            }

            if (
                resultado.affectedRows === 0
            ) {

                return res.status(404).json({
                    error:
                        'El registro ya fue completado o no pertenece al usuario'
                });

            }

            /*
             * Analizamos la descripción para determinar
             * si corresponde modificar el inventario.
             */
            const movimiento =
                analizarCambioInventario(
                    cambios
                );

            /*
             * Si no se detectó un movimiento,
             * solamente terminamos correctamente.
             */
            if (!movimiento) {

                return res.json({
                    correcto: true,
                    mensaje:
                        'Descripción guardada correctamente'
                });

            }

            /*
             * Buscamos si el elemento ya existe.
             */
            const sqlInventario = `
                SELECT
                    cantidad
                FROM inventario
                WHERE
                    LOWER(TRIM(bien_almacenado))
                    =
                    LOWER(TRIM(?))
                LIMIT 1
            `;

            conexion.query(
                sqlInventario,
                [movimiento.bien],
                (errorInventario, resultados) => {

                    if (errorInventario) {

                        console.error(
                            '❌ Error consultando inventario:',
                            errorInventario
                        );

                        return res.status(500).json({
                            error:
                                'El cambio fue guardado, pero no se pudo actualizar el inventario'
                        });

                    }

                    /*
                     * El elemento ya existe.
                     */
                    if (
                        resultados &&
                        resultados.length > 0
                    ) {

                        const cantidadActual =
                            Number(
                                resultados[0].cantidad
                            ) || 0;

                        const nuevaCantidad =
                            cantidadActual +
                            movimiento.cantidad;

                        const sqlActualizar = `
                            UPDATE inventario
                            SET
                                cantidad = ?
                            WHERE
                                LOWER(TRIM(bien_almacenado))
                                =
                                LOWER(TRIM(?))
                        `;

                        conexion.query(
                            sqlActualizar,
                            [
                                nuevaCantidad,
                                movimiento.bien
                            ],
                            (errorActualizar) => {

                                if (errorActualizar) {

                                    console.error(
                                        '❌ Error actualizando inventario:',
                                        errorActualizar
                                    );

                                    return res.status(500).json({
                                        error:
                                            'El cambio fue guardado, pero no se pudo actualizar el inventario'
                                    });

                                }

                                return res.json({
                                    correcto: true,
                                    mensaje:
                                        'Descripción e inventario actualizados correctamente'
                                });

                            }
                        );

                        return;
                    }

                    /*
                     * El elemento no existe.
                     *
                     * Solo tiene sentido crear el registro
                     * cuando estamos ingresando algo.
                     */
                    if (
                        movimiento.cantidad <= 0
                    ) {

                        return res.json({
                            correcto: true,
                            mensaje:
                                'Descripción guardada correctamente'
                        });

                    }

                    const sqlInsertar = `
                        INSERT INTO inventario
                        (
                            bien_almacenado,
                            cantidad
                        )
                        VALUES (?, ?)
                    `;

                    conexion.query(
                        sqlInsertar,
                        [
                            movimiento.bien,
                            movimiento.cantidad
                        ],
                        (errorInsertar) => {

                            if (errorInsertar) {

                                console.error(
                                    '❌ Error insertando en inventario:',
                                    errorInsertar
                                );

                                return res.status(500).json({
                                    error:
                                        'El cambio fue guardado, pero no se pudo agregar al inventario'
                                });

                            }

                            return res.json({
                                correcto: true,
                                mensaje:
                                    'Descripción e inventario actualizados correctamente'
                            });

                        }
                    );

                }
            );

        }
    );

});

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
            u.Nombre_usuario AS Nombre,
            r.Fecha,
            r.Horario_apertura,
            r.Horario_cierre,
            r.Cambios,
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

// COMPROBAR ADMINISTRADOR
function obtenerAdministrador(req, res) {

    const sesionId =
        req.headers['x-sesion-id'];

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
            error:
                'Sesión expirada o no válida'
        });

        return null;

    }

    const cargo =
        String(sesion.Cargo || '')
            .trim()
            .toLowerCase();

    const esAdministrador =
        cargo === 'admin' ||
        cargo === 'administrador';

    if (!esAdministrador) {

        res.status(403).json({
            error:
                'No tenés permisos de administrador'
        });

        return null;

    }

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
        Cargo,
        Correo_electronico,
        Clave,
        Uid_tarjeta
    } = req.body;

    if (
        !Nombre_usuario ||
        !Cargo ||
        !Correo_electronico ||
        Clave === undefined ||
        Clave === null ||
        !Uid_tarjeta
    ) {

        return res.status(400).json({
            correcto: false,
            mensaje:
                'Todos los campos son obligatorios'
        });

    }

    const uid =
        String(Uid_tarjeta)
            .trim()
            .toUpperCase();

    // COMPROBAR TARJETA LIBRE
    const sqlTarjeta = `
        SELECT
            Uid_tarjeta
        FROM dispositivos
        WHERE
            Uid_tarjeta = ?
            AND Id_usuario IS NULL
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

                return res.status(400).json({
                    correcto: false,
                    mensaje:
                        'La tarjeta no existe o ya está asignada a otro usuario'
                });

            }

            // CREAR USUARIO
            const sqlUsuario = `
                INSERT INTO usuarios
                (
                    Nombre_usuario,
                    Cargo,
                    Correo_electronico,
                    Clave,
                    Uid_tarjeta
                )
                VALUES
                (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?
                )
            `;

            conexion.query(
                sqlUsuario,
                [
                    Nombre_usuario,
                    Cargo,
                    Correo_electronico,
                    Clave,
                    uid
                ],
                (errorUsuario, resultadoUsuario) => {

                    if (errorUsuario) {

                        console.error(
                            '❌ Error creando usuario:',
                            errorUsuario
                        );

                        return res.status(500).json({
                            correcto: false,
                            mensaje:
                                'No se pudo crear la cuenta'
                        });

                    }

                    const idUsuario =
                        resultadoUsuario.insertId;

                    // ASIGNAR TARJETA
                    const sqlAsignar = `
                        UPDATE dispositivos
                        SET
                            Id_usuario = ?
                        WHERE
                            Uid_tarjeta = ?
                            AND Id_usuario IS NULL
                    `;

                    conexion.query(
                        sqlAsignar,
                        [
                            idUsuario,
                            uid
                        ],
                        (errorAsignar, resultadoAsignar) => {

                            if (errorAsignar) {

                                console.error(
                                    '❌ Error asignando tarjeta:',
                                    errorAsignar
                                );

                                conexion.query(
                                    `
                                    DELETE FROM usuarios
                                    WHERE Id_usuario = ?
                                    `,
                                    [idUsuario]
                                );

                                return res.status(500).json({
                                    correcto: false,
                                    mensaje:
                                        'El usuario fue creado pero no se pudo asignar la tarjeta'
                                });

                            }

                            if (
                                resultadoAsignar.affectedRows === 0
                            ) {

                                conexion.query(
                                    `
                                    DELETE FROM usuarios
                                    WHERE Id_usuario = ?
                                    `,
                                    [idUsuario]
                                );

                                return res.status(400).json({
                                    correcto: false,
                                    mensaje:
                                        'La tarjeta ya no está disponible'
                                });

                            }

                            console.log(
                                '✅ Usuario creado:',
                                Nombre_usuario
                            );

                            console.log(
                                '🪪 Tarjeta asignada:',
                                uid
                            );

                            return res.json({

                                correcto: true,

                                mensaje:
                                    'Cuenta creada correctamente',

                                Id_usuario:
                                    idUsuario

                            });

                        }
                    );

                }
            );

        }
    );

});

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

            return res.json(resultados);

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
// Ejecutar "node index.js" para iniciar el servidor. Ejecutar "http://localhost:3000" o Crtl + C dos veces para apagarlo.