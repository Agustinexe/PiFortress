const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// CONEXIÓN A LA BASE DE DATOS
const conexion = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'pifortress'
});

conexion.connect((error) => {
    if (error) {
        console.error(
            '❌ Error en la base de datos:',
            error.message
        );
        return;
    }
    console.log('✅ Conexión exitosa a HeidiSQL');
});

// SESIONES
const sesiones = new Map();

// PÁGINA PRINCIPAL
app.get('/', (req, res) => {
    res.sendFile(
        path.join(__dirname, 'index.html')
    );
});

// VERIFICAR USUARIO
app.post('/verificar', (req, res) => {
    const {
        Nombre_usuario,
        Correo_electronico,
        Clave
    } = req.body;

    // PRIMERA CAPA:
    // COMPROBAR DATOS DEL USUARIO
    const queryUsuario = `
        SELECT
            Id_usuario,
            Nombre_usuario,
            Cargo,
            Correo_electronico,
            Clave,
            Uid_tarjeta
        FROM usuarios
        WHERE Nombre_usuario = ?
          AND Correo_electronico = ?
          AND Clave = ?
    `;
    conexion.query(
        queryUsuario,
        [
            Nombre_usuario,
            Correo_electronico,
            Clave
        ],
        (err, usuarios) => {
            if (err) {
                console.error(
                    '❌ Error al consultar usuarios:',
                    err
                );
                return res.status(500).json({
                    valido: false,
                    error: 'Error del servidor'
                });
            }

            // DATOS INCORRECTOS
            if (usuarios.length === 0) {
                return res.json({
                    valido: false,
                    mensaje: 'Los datos ingresados no coinciden'
                });
            }

            const usuario = usuarios[0];
            
            // SEGUNDA CAPA:
            // COMPROBAR TARJETA EN DISPOSITIVOS
            const queryDispositivo = `
                SELECT
                    Uid_tarjeta,
                    Id_usuario,
                    Habilitado
                FROM dispositivos
                WHERE Uid_tarjeta = ?
                  AND Id_usuario = ?
            `;

            conexion.query(
                queryDispositivo,
                [
                    usuario.Uid_tarjeta,
                    usuario.Id_usuario
                ],
                (err, dispositivos) => {
                    if (err) {
                        console.error(
                            '❌ Error al consultar dispositivos:',
                            err
                        );
                        return res.status(500).json({
                            valido: false,
                            error: 'Error del servidor'
                        });
                    }

                    // TARJETA NO REGISTRADA
                    if (dispositivos.length === 0) {
                        return res.json({
                            valido: false,
                            mensaje: 'El dispositivo no está autorizado'
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
                            mensaje:
                                'El dispositivo está deshabilitado'
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

                            Cargo:
                                usuario.Cargo,

                            Correo_electronico:
                                usuario.Correo_electronico,

                            Uid_tarjeta:
                                usuario.Uid_tarjeta
                        }
                    );

                    // ACCESO AUTORIZADO
                    return res.json({
                        valido: true,
                        sesionId: sesionId,
                        usuario: {
                            Id_usuario:
                                usuario.Id_usuario,

                            Nombre_usuario:
                                usuario.Nombre_usuario,

                            Cargo:
                                usuario.Cargo,

                            Correo_electronico:
                                usuario.Correo_electronico
                        }
                    });
                }
            );
        }
    );
});

// OBTENER REGISTROS
app.get('/registros', (req, res) => {
    const {
        dia,
        usuario,
        cambios
    } = req.query;

    let query = `
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

    const params = [];

    // FILTRO POR FECHA
    if (dia) {
        query += `
            AND r.Fecha = ?
        `;
        params.push(dia);
    }

    // FILTRO POR USUARIO
    if (usuario) {
        query += `
            AND u.Nombre_usuario LIKE ?
        `;

        params.push(
            `%${usuario}%`
        );
    }

    // FILTRO POR CAMBIOS
    if (cambios) {
        query += `
            AND r.Cambios LIKE ?
        `;

        params.push(
            `%${cambios}%`
        );
    }

    // ORDEN
    query += `
        ORDER BY
            r.Fecha DESC,
            r.Horario_apertura DESC
    `;

    conexion.query(
        query,
        params,
        (err, resultados) => {
            if (err) {
                console.error(
                    '❌ Error al obtener registros:',
                    err
                );

                return res.status(500).json({
                    error:
                        'Error en la base de datos'
                });
            }

            res.json(resultados);
        }
    );
});

// OBTENER TODOS LOS USUARIOS
app.get('/usuarios', (req, res) => {
    const sesionId =
        req.headers['x-sesion-id'];

    // COMPROBAR SESIÓN
    const sesion =
        sesiones.get(sesionId);

    if (!sesion) {
        return res.status(401).json({
            error:
                'Sesión no válida o expirada'
        });
    }

    // COMPROBAR CARGO
    const cargo =
        String(sesion.Cargo)
            .trim()
            .toLowerCase();
    if (
        cargo !== 'admin' &&
        cargo !== 'administrador'
    ) {
        return res.status(403).json({
            error: 'No tiene permisos de administrador'
        });
    }

    // OBTENER USUARIOS
    const query = `
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
            u.Nombre_usuario ASC
    `;

    conexion.query(
        query,
        (err, resultados) => {
            if (err) {
                console.error(
                    '❌ Error al obtener usuarios:',
                    err
                );
                return res.status(500).json({
                    error:
                        'Error en la base de datos'
                });
            }

            res.json(resultados);
        }
    );

});

// CAMBIAR ESTADO DE UNA TARJETA
app.post(
    '/usuarios/:uid/tarjeta',
    (req, res) => {
        const sesionId =
            req.headers['x-sesion-id'];

        const sesion =
            sesiones.get(sesionId);

        // COMPROBAR SESIÓN
        if (!sesion) {
            return res.status(401).json({
                error:
                    'Sesión no válida o expirada'
            });
        }

        // COMPROBAR CARGO
        const cargo =
            String(sesion.Cargo)
                .trim()
                .toLowerCase();
        if (
            cargo !== 'admin' &&
            cargo !== 'administrador'
        ) {
            return res.status(403).json({
                error:
                    'No tiene permisos de administrador'
            });
        }

        // OBTENER UID
        const uid =
            req.params.uid;

        const { habilitado } =
            req.body;

        // VALIDAR VALOR
        if (
            habilitado !== true &&
            habilitado !== false
        ) {
            return res.status(400).json({
                error:
                    'El estado enviado no es válido'
            });
        }

        const nuevoEstado =
            habilitado
                ? 'True'
                : 'False';

        // ACTUALIZAR DISPOSITIVO
        const query = `
            UPDATE dispositivos
            SET Habilitado = ?
            WHERE Uid_tarjeta = ?
        `;

        conexion.query(
            query,
            [
                nuevoEstado,
                uid
            ],
            (err, resultado) => {
                if (err) {
                    console.error(
                        '❌ Error al actualizar tarjeta:',
                        err
                    );
                    return res.status(500).json({
                        error:
                            'Error en la base de datos'
                    });
                }

                // TARJETA NO ENCONTRADA
                if (
                    resultado.affectedRows === 0
                ) {
                    return res.status(404).json({
                        error:
                            'Tarjeta no encontrada'
                    });
                }

                // ÉXITO
                res.json({
                    correcto: true,
                    Uid_tarjeta: uid,
                    Habilitado:
                        nuevoEstado
                });
            }
        );
    }
);

// CERRAR SESIÓN
app.post('/cerrar-sesion', (req, res) => {
    const sesionId =
        req.headers['x-sesion-id'];
    if (sesionId) {
        sesiones.delete(sesionId);
    }
    res.json({
        correcto: true
    });
});

// INICIAR SERVIDOR
app.listen(PORT, () => {
    console.log(
        `✅ Servidor corriendo en http://localhost:${PORT}`
    );
});

// Ejecutar "node index.js" para iniciar el servidor. Ejecutar "http://localhost:3000" o Crtl + C dos veces para apagarlo.