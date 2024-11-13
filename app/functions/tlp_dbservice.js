const log = require("../functions/logger.js").LOG;
const sql = require("mssql");
const dbConfig = require("../config/tlp_dbconfig");


async function testConnection() {
  try {
    // Connect to the database
    let pool = await sql.connect(dbConfig);
    log.info('Connected to SQL Server');

    // Query example - replace with your actual query
    let result = await pool.request().query('SELECT @@version AS version');
    log.info(`Query Result: ${result.recordset} `);

  } catch (err) {
    // Handle connection errors
    log.error(`SQL error: ${err} `);
  } finally {
    // Close the database connection
    await sql.close();
    log.info('Connection closed');
  }
}


async function insertIvrVoicemail(dataList) {
  try {
    let pool = await sql.connect(dbConfig);
    await Promise.all(
      dataList.map(async (element) => {
        const data = element.split('|');

        if (data[3] == '') {
          data[3] = null;
        }

        if (data[0] != '') {
          const result = await sql.query`SELECT * FROM IVR_TLP_VOICEMAIL WHERE UCID = ${data[0]}`;
          if (result.recordset.length === 0) {
            await pool
              .request()
              .input("UCID", sql.VarChar, data[0])
              .input("CUSTOMER", sql.VarChar, data[1])
              .input("START_TIME", sql.VarChar, data[2])
              .input("ID", sql.VarChar, data[3])
              .input("PATH", sql.VarChar, data[4])
              .input("DEPARTMENT", sql.VarChar, data[5])
              .query('insert into IVR_TLP_VOICEMAIL (UCID, CUSTOMER, START_TIME, ID, PATH, DEPARTMENT) values(@UCID, @CUSTOMER, @START_TIME, @ID, @PATH, @DEPARTMENT)');

            log.info(`Inserted new row into IVR_TLP_VOICEMAIL with UCID: ${data[0]} `);
          } else {
            await pool
              .request()
              .input("UCID", sql.VarChar, data[0])
              .input("CUSTOMER", sql.VarChar, data[1])
              .input("START_TIME", sql.VarChar, data[2])
              .input("ID", sql.VarChar, data[3])
              .input("PATH", sql.VarChar, data[4])
              .input("DEPARTMENT", sql.VarChar, data[5])
              .query('UPDATE IVR_TLP_VOICEMAIL SET CUSTOMER = @CUSTOMER, START_TIME = @START_TIME, ID = @ID, PATH=@PATH, DEPARTMENT = @DEPARTMENT WHERE UCID = @UCID');

            log.info(`Updated row in IVR_TLP_VOICEMAIL with UCID: ${data[0]} `);
          }
        }
      })
    );
  } catch (err) {
    log.error(`insertIvrVoicemail(), error: ${err}`);
  } finally {
    // Close the SQL Server connection
    await sql.close();
  }
}

module.exports = {
  testConnection,
  insertIvrVoicemail
};
