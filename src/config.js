const sqlConfig = {
    user: 'electron-admin',  // Azure SQL kullanıcı adınız
    password: ' ',  // Azure SQL şifreniz
    database: ' ',
    server: 'server-electron.database.windows.net',
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: true,
        trustServerCertificate: false
    },
    port: 1433
};

module.exports = sqlConfig;
