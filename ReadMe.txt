step: 1 Clone Project to Local
      git clone https://github.com/yangkrua/thailife-genesys-middleware-phase2.git

step: 2 cd to project path, then type as bellow. to install node module 
      npm install

=================================================================================
Schedule Jobs on Crontab System, Basic command
=================================================================================
1. crontab -l                     ==> display all crontab job
2. sudo service cron reload       ==> reload job crontab
   sudo service cron restart     
3. crontab -e                     ==> edit job crontab

=================================================================================
crontab guru
=================================================================================
  5      4      *             *       *
minute hour   day(month)   month    day(week)  


=================================================================================
Script-Crontab                   | Schedule-Time
=================================================================================
1. Get_Survey_Detail.js          | Daily every 10 Minute
2. ACC_CALLBACK.js               | Daily every hour, start from: 17.00 - 9.00
3. ACC_VOICEMAIL.js              | Daily every hour, start from: 17.00 - 9.00
4. care_callback.js              | Daily every hour, start from: 21.00 - 8.00
5. care_voicemail.js             | Daily every hour, start from: 21.00 - 8.00
6. TLP_Voicemail.js              | Every hour
7. ivr_log.js                    | Everu hour
8. ACC_INB_genAbandon.js         | Daily one time, at: 23.00
9. bay_genAbandon.js             | Daily one time, at: 23.05
10.care_center_genAbandon.js     | Daily one time, at: 23.10
11.ccc_genAbandon.js             | Daily one time, at: 23.15
12.ccd_genAbandon.js             | Daily one time, at: 23.20
13.cimb_genAbandon.js            | Daily one time, at: 23.25
14.crm_genAbandon.js             | Daily one time, at: 23.30
15.pos_genAbandon.js             | Daily one time, at: 23.35
16.ucc_genAbandon.js             | Daily one time, at: 23.40
17.ACC_L_ABANDON_OUTBOUND.js     | Daily every hour, start from: 8.00 - 17.00
18.ACC_L_CALLBACK_OUTBOUND.js    | Daily every hour, start from: 18.00 - 8.00










