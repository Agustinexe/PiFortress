const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// =====================================================
// CONEXIÓN CON LA BASE DE DATOS
// =====================================================

const conexion = mysql.createConnection({
host: '127.0.0.1',
user: 'root',
password: '',
database: 'pifortress'
});

conexion.connect(error => {

if (error) {

    console.error(
        '❌ Error conectando con MySQL:',
        error
    );

    return;

}

console.log(
    '✅ Conectado a la base de datos pifortress'
);


});

// =====================================================
// CONFIGURACIÓN DE EXPRESS
// =====================================================

app.use(express.json());

app.use(
express.urlencoded({
extended: true
})
);

app.use(
express.static(__dirname)
);

// =====================================================
// SESIONES
// =====================================================

const sesiones = new Map();

// =====================================================
// PÁGINA PRINCIPAL
// =====================================================

app.get('/', (req, res) => {


res.sendFile(
    path.join(
        __dirname,
        'index.html'
    )
);


});

// =====================================================
// VERIFICAR USUARIO
// =====================================================

app.post('/verificar', (req, res) => {


const {
    Nombre_usuario,
    Correo_electronico,
    Clave
} = req.body;

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
                mensaje:
                    'Error interno del servidor'
            });

        }

        if (
            !resultados ||
            resultados.length === 0
        ) {

            return res.json({
                valido: false,
                mensaje:
                    'Alguno de los datos no coincide'
            });

        }

        const usuario =
            resultados[0];

        // =========================================
        // VERIFICAR TARJETA
        // =========================================

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
                        mensaje:
                            'Error verificando la tarjeta'
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

                // =================================
                // TARJETA DESHABILITADA
                // =================================

                if (
                    dispositivo.Habilitado !==
                    'True'
                ) {

                    return res.json({
                        valido: false,
                        mensaje:
                            'La tarjeta está deshabilitada'
                    });

                }

                // =================================
                // CREAR SESIÓN
                // =================================

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

// =====================================================
// OBTENER REGISTROS
// =====================================================

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
        ON r.Uid_tarjeta =
           u.Uid_tarjeta
    WHERE 1 = 1
`;

const parametros = [];

// FILTRO POR DÍA

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

        res.json(resultados);

    }
);


});

// =====================================================
// VERIFICAR SESIÓN DE ADMINISTRADOR
// =====================================================

function obtenerAdministrador(
req,
res
) {


const sesionId =
    req.headers['x-sesion-id'];

if (!sesionId) {

    res.status(401).json({
        error:
            'Sesión no válida'
    });

    return null;

}

const sesion =
    sesiones.get(
        sesionId
    );

if (!sesion) {

    res.status(401).json({
        error:
            'Sesión expirada o no válida'
    });

    return null;

}

const cargo =
    String(
        sesion.Cargo
    )
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

// =====================================================
// OBTENER TARJETAS DISPONIBLES PARA REGISTRO DE CUENTA
// =====================================================

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
                '❌ Error obteniendo tarjetas disponibles:',
                error
            );

            return res.status(500).json({
                error:
                    'No se pudieron cargar las tarjetas disponibles'
            });

        }

        res.json(resultados);

    }
);


});

// =====================================================
// CREAR NUEVA CUENTA
// =====================================================

app.post('/crear-cuenta', (req, res) => {


const {
    Nombre_usuario,
    Cargo,
    Correo_electronico,
    Clave,
    Uid_tarjeta
} = req.body;

// =========================================
// VALIDAR DATOS
// =========================================

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
    String(
        Uid_tarjeta
    ).trim();

// =========================================
// COMPROBAR QUE LA TARJETA EXISTE Y ESTÁ LIBRE
// =========================================

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

        // =====================================
        // CREAR USUARIO
        // =====================================

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

                // =================================
                // ASIGNAR TARJETA AL USUARIO
                // =================================

                const sqlAsignar = `
                    UPDATE dispositivos
                    SET Id_usuario = ?
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

                            // DESHACER USUARIO
                            // SI FALLA LA ASIGNACIÓN

                            conexion.query(
                                `
                                DELETE FROM usuarios
                                WHERE Id_usuario = ?
                                `,
                                [idUsuario],
                                () => {}
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
                                [idUsuario],
                                () => {}
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

                        console.log(
                            '👤 Id_usuario:',
                            idUsuario
                        );

                        res.json({

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

// =====================================================
// OBTENER USUARIOS
// =====================================================

app.get('/usuarios', (req, res) => {


const administrador =
    obtenerAdministrador(
        req,
        res
    );

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
        ON u.Id_usuario =
           d.Id_usuario
        AND u.Uid_tarjeta =
            d.Uid_tarjeta
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

        res.json(resultados);

    }
);


});

// =====================================================
// CAMBIAR ESTADO DE TARJETA
// =====================================================

app.post(
'/usuarios/:uid/tarjeta',
(req, res) => {


    const administrador =
        obtenerAdministrador(
            req,
            res
        );

    if (!administrador) {
        return;
    }

    const uid =
        req.params.uid;

    const {
        habilitado
    } = req.body;

    if (
        typeof habilitado !==
        'boolean'
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
        SET Habilitado = ?
        WHERE Uid_tarjeta = ?
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

            res.json({

                correcto: true,

                Habilitado:
                    nuevoEstado

            });

        }
    );

}


);

// =====================================================
// CARGAR NUEVA TARJETA
// =====================================================

app.post(
'/usuarios/tarjetas',
(req, res) => {


    const administrador =
        obtenerAdministrador(
            req,
            res
        );

    if (!administrador) {
        return;
    }

    const {
        Uid_tarjeta
    } = req.body;

    // =========================================
    // VALIDAR UID
    // =========================================

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
        String(
            Uid_tarjeta
        ).trim();

    // =========================================
    // COMPROBAR SI EL UID YA EXISTE
    // =========================================

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

            // =================================
            // INSERTAR NUEVA TARJETA
            // =================================

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

                    res.json({

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

}


);

// =====================================================
// CERRAR SESIÓN
// =====================================================

app.post(
'/cerrar-sesion',
(req, res) => {


    const sesionId =
        req.headers['x-sesion-id'];

    if (sesionId) {

        sesiones.delete(
            sesionId
        );

    }

    res.json({
        correcto: true
    });

}

);

// =====================================================
// INICIAR SERVIDOR
// =====================================================

app.listen(
PORT,
() => {


    console.log('');

    console.log(
        '======================================'
    );

    console.log(
        '   PiFortress iniciado correctamente'
    );

    console.log(
        '======================================'
    );

    console.log(
        `🌐 http://localhost:${PORT}`
    );

    console.log('');

}


);


// Ejecutar "node index.js" para iniciar el servidor. Ejecutar "http://localhost:3000" o Crtl + C dos veces para apagarlo.