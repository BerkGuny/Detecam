const sql = require('mssql');
const config = require('./config');

async function authenticate(password) {
    try {
        // Veritabanına bağlan
        await sql.connect(config);

        // Veritabanında şifreyi sorgula
        const result = await sql.query`SELECT * FROM Users WHERE Password = ${password}`;
        console.log(result.recordset);
        // Bağlantıyı kapat
        await sql.close();

        // Şifre doğruysa true dön, aksi halde false
        return result.recordset.length > 0;
    } catch (err) {
        // Hata mesajını konsola yaz
        console.error('Database connection error', err);

        // Bağlantıyı kapat
        await sql.close();

        // Hata durumunda false dön
        return false;
    }
}

module.exports = authenticate;
