const log = require("../functions/logger").LOG;
const sql = require("mssql");
const dbConfig = require("../config/survey_dbconfig");


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
    log.error(`SQL error': ${err} `);
  } finally {
    // Close the database connection
    await sql.close();
    log.info('Connection closed');
  }
}

async function insertOrUpdateIVRSurvey(data) {
  const { UCID, CUSTOMER, SCORE, START_TIME, UPDATE_TIME, UUI, AGENT, ID, UCID2 } = data;

  try {
    // Connect to SQL Server
    await sql.connect(dbConfig);

    // Check if UCID exists in IVR_SURVEY
    const result = await sql.query(`SELECT * FROM IVR_SURVEY WHERE UCID = ${UCID}`);

    if (result.recordset.length === 0) {
      // UCID does not exist, perform INSERT
      await sql.query(`
          INSERT INTO IVR_SURVEY (UCID, CUSTOMER, SCORE, START_TIME, UPDATE_TIME, UUI, AGENT, ID, UCID2)
          VALUES (${UCID}, ${CUSTOMER}, ${SCORE}, ${START_TIME}, ${UPDATE_TIME}, ${UUI}, ${AGENT}, ${ID}, ${UCID2})
        ` );

      log.info(`Inserted new row into IVR_SURVEY with UCID: ${UCID} `);
    } else {
      // UCID exists, perform UPDATE
      await sql.query(`
          UPDATE IVR_SURVEY
          SET CUSTOMER = ${CUSTOMER}, SCORE = ${SCORE}, START_TIME = ${START_TIME}, UPDATE_TIME = ${UPDATE_TIME},
              UUI = ${UUI}, AGENT = ${AGENT}, ID = ${ID}, UCID2 = ${UCID2}
          WHERE UCID = ${UCID}
        `);
      log.info(`Updated row in IVR_SURVEY with UCID: ${UCID} `);
    }
  } catch (error) {
    log.error(`Error performing insertOrUpdateIVRSurvey: ${error} `);
  } finally {
    // Close the SQL Server connection
    await sql.close();
  }
}

module.exports = {
  testConnection,
  insertOrUpdateIVRSurvey
};
