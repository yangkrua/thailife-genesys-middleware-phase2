const sql = require("mssql");
const config = require("../config/acc_dbconfig");

async function testConnection() {
  try {
      // Connect to the database
      let pool = await sql.connect(config);
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

async function insertIvrAccVoicemail(dataList) {
  try {
    let pool = await sql.connect(config);
    await Promise.all(
      dataList.map(async (element) => {
        const data = element.split('|');
        if(data[0] != ''){

          if(data[3] == '-'){
            data[3] = ''
          }
          const result = await sql.query`SELECT * FROM IVR_ACC_VOICEMAIL WHERE UCID = ${data[0]}`;
            if (result.recordset.length === 0) { 
              await pool
              .request()
              .input("UCID", sql.VarChar, data[0])
              .input("CUSTOMER", sql.VarChar, data[1])
              .input("START_TIME", sql.VarChar, data[2])
              .input("ID", sql.VarChar, data[3])
              .input("PATH", sql.VarChar, data[4])
              .input("DEPARTMENT", sql.VarChar, data[5])
              .query('insert into IVR_ACC_VOICEMAIL (UCID, CUSTOMER, START_TIME, ID, PATH, DEPARTMENT) values(@UCID, @CUSTOMER, @START_TIME, @ID, @PATH, @DEPARTMENT)');
              console.log('Inserted new row into IVR_ACC_VOICEMAIL with UCID:', data[0]);
            } else {
              await pool
              .request()
              .input("UCID", sql.VarChar, data[0])
              .input("CUSTOMER", sql.VarChar, data[1])
              .input("START_TIME", sql.VarChar, data[2])
              .input("ID", sql.VarChar, data[3])
              .input("PATH", sql.VarChar, data[4])
              .input("DEPARTMENT", sql.VarChar, data[5])
              .query('UPDATE IVR_ACC_VOICEMAIL SET CUSTOMER = @CUSTOMER, START_TIME = @START_TIME, ID = @ID, PATH=@PATH, DEPARTMENT = @DEPARTMENT WHERE UCID = @UCID');
              
              console.log('Updated row in IVR_ACC_VOICEMAIL with UCID:',  data[0]);
            }
          }
      })
        );
      } catch (err) {
        console.log(err);
      } finally {
        // Close the SQL Server connection
        await sql.close();
      }
}

async function insertIvrAccCallback(dataList) {
  try {
    let pool = await sql.connect(config);
    await Promise.all(
      dataList.map(async (element) => {
        const data = element.split('|');
        if(data[0] != ''){

          if(data[3] == '-'){
            data[3] = ''
          }
          const result = await sql.query`SELECT * FROM IVR_ACC_CALLBACK WHERE UCID = ${data[0]}`;
          if (result.recordset.length === 0) { 
          await pool
            .request()
            .input("UCID", sql.VarChar, data[0])
            .input("CUSTOMER", sql.VarChar, data[1])
            .input("START_TIME", sql.VarChar, data[2])
            .input("ID", sql.VarChar, data[3])
            .input("DEPARTMENT", sql.VarChar, data[4])
            .query('insert into IVR_ACC_CALLBACK (UCID, CUSTOMER, START_TIME, ID, DEPARTMENT) values(@UCID, @CUSTOMER, @START_TIME, @ID, @DEPARTMENT)');
        
            console.log('Inserted new row into IVR_ACC_CALLBACK with UCID:', data[0]);
          } else {
          await pool
          .request()
          .input("UCID", sql.VarChar, data[0])
          .input("CUSTOMER", sql.VarChar, data[1])
          .input("START_TIME", sql.VarChar, data[2])
          .input("ID", sql.VarChar, data[3])
          .input("DEPARTMENT", sql.VarChar, data[4])
          .query('UPDATE IVR_ACC_CALLBACK SET CUSTOMER = @CUSTOMER, START_TIME = @START_TIME, ID = @ID, DEPARTMENT = @DEPARTMENT WHERE UCID = @UCID');
       
          console.log('Updated row in IVR_ACC_CALLBACK with UCID:',  data[0]);

        }

      }
  })
    );
  } catch (err) {
    console.log(err);
  } finally {
    // Close the SQL Server connection
    await sql.close();
  }
}

async function insertOrUpdateIVRSurvey(data) {
  const { UCID, CUSTOMER, SCORE, START_TIME, UPDATE_TIME, UUI, AGENT, ID, UCID2 } = data;

  try {
    // Connect to SQL Server
    await sql.connect(config);

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
  insertIvrAccVoicemail: insertIvrAccVoicemail,
  insertIvrAccCallback: insertIvrAccCallback,
  testConnection: testConnection,
  insertOrUpdateIVRSurvey: insertOrUpdateIVRSurvey
};
