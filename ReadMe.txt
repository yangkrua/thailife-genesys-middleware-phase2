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

application-root-path: /home/genesys/middleware/genesys_middleware_phase2
application-logs-path: /home/genesys/middleware/genesys_middleware_phase2/logs
=================================================================================
Script-Crontab                   | Schedule-Time        |Javascript-File
=================================================================================
1. Get_Survey_Detail.sh          | */10 * * * *         | Get_Survey_Detail.js
2. ACC_CALLBACK.sh               | 40 17-23 * * *       | ACC_CALLBACK.js
3. ACC_CALLBACK.sh               | 40 0-8 * * *         | ACC_CALLBACK.js
4. ACC_VOICEMAIL.sh              | 40 17-23 * * *       | ACC_VOICEMAIL.js
5. ACC_VOICEMAIL.sh              | 40 0-8 * * *         | ACC_VOICEMAIL.js 
6. care_callback.sh              | 0 21-23 * * *        | care_callback.js
7. care_callback.sh              | 0 0-8 * * *          | care_callback.js
8. care_voicemail.sh             | 0 21-23 * * *        | care_voicemail.js
9. care_voicemail.sh             | 0 0-8 * * *          | care_voicemail.js 
10. TLP_Voicemail.sh             | 0 * * * *            | TLP_Voicemail.js
11. ivr_log.sh                   | 0 * * * *            | ivr_log.js
12. ACC_INB_genAbandon.sh        | 0 23 * * *           | ACC_INB_genAbandon.js
13. bay_genAbandon.sh            | 5 23 * * *           | bay_genAbandon.js
14. care_center_genAbandon.sh    | 10 23 * * *          | care_center_genAbandon.js
15. ccc_genAbandon.sh            | 15 23 * * *          | ccc_genAbandon.js
16. ccd_genAbandon.sh            | 20 23 * * *          | ccd_genAbandon.js
17. cimb_genAbandon.sh           | 25 23 * * *          | cimb_genAbandon.js
18. crm_genAbandon.sh            | 30 23 * * *          | crm_genAbandon.js  
19. pos_genAbandon.sh            | 25 23 * * *          | pos_genAbandon.js
20. ucc_genAbandon.sh            | 40 23 * * *          | ucc_genAbandon.js
21. ACC_L_ABANDON_OUTBOUND.sh    | 0 8-17 * * *         | ACC_L_ABANDON_OUTBOUND.js
22. ACC_L_CALLBACK_OUTBOUND.sh   | 0 18-23 * * *        | ACC_L_CALLBACK_OUTBOUND.js
23. ACC_L_CALLBACK_OUTBOUND.sh   | 0 0-8 * * *          | ACC_L_CALLBACK_OUTBOUND.js












