const sql = require("mssql");
const dbConfig = require("../config/survey_dbconfig");


async function testConnection() {
  try {
      // Connect to the database
      let pool = await sql.connect(dbConfig);
      console.log('Connected to SQL Server');

      // Query example - replace with your actual query
      let result = await pool.request().query('SELECT @@version AS version');
      console.log('Query Result:', result.recordset);

  } catch (err) {
      // Handle connection errors
      console.error('SQL error', err);
  } finally {
      // Close the database connection
      await sql.close();
      console.log('Connection closed');
  }
}

async function insertOrUpdateIVRSurvey(data) {
    const { UCID, CUSTOMER, SCORE, START_TIME, UPDATE_TIME, UUI, AGENT, ID, UCID2 } = data;
  
    try {
      // Connect to SQL Server
      await sql.connect(dbConfig);
  
      // Check if UCID exists in IVR_SURVEY
      const result = await sql.query`SELECT * FROM IVR_SURVEY WHERE UCID = ${UCID}`;
  
      if (result.recordset.length === 0) {
        // UCID does not exist, perform INSERT
        await sql.query`
          INSERT INTO IVR_SURVEY (UCID, CUSTOMER, SCORE, START_TIME, UPDATE_TIME, UUI, AGENT, ID, UCID2)
          VALUES (${UCID}, ${CUSTOMER}, ${SCORE}, ${START_TIME}, ${UPDATE_TIME}, ${UUI}, ${AGENT}, ${ID}, ${UCID2})
        `;
        console.log('Inserted new row into IVR_SURVEY with UCID:', UCID);
      } else {
        // UCID exists, perform UPDATE
        await sql.query`
          UPDATE IVR_SURVEY
          SET CUSTOMER = ${CUSTOMER}, SCORE = ${SCORE}, START_TIME = ${START_TIME}, UPDATE_TIME = ${UPDATE_TIME},
              UUI = ${UUI}, AGENT = ${AGENT}, ID = ${ID}, UCID2 = ${UCID2}
          WHERE UCID = ${UCID}
        `;
        console.log('Updated row in IVR_SURVEY with UCID:', UCID);
      }
    } catch (error) {
      console.error('Error performing insertOrUpdateIVRSurvey:', error);
    } finally {
      // Close the SQL Server connection
      await sql.close();
    }
  }
  
module.exports = {
  testConnection,
  insertOrUpdateIVRSurvey
};
