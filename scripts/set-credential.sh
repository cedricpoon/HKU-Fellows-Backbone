env="./.env"

if [ ! -f "$env" ] && [ -z $RDS_HOSTNAME ]; then
  read -p $'Please enter \e[33;1mHostname\e[0m of \e[32mRDS\e[0m: ' RDS_HOSTNAME
  echo "RDS_HOSTNAME=$RDS_HOSTNAME" >> ".env"

  read -p $'Please enter \e[33;1mUsername\e[0m of \e[32mRDS\e[0m: ' RDS_USERNAME
  echo "RDS_USERNAME=$RDS_USERNAME" >> ".env"

  read -sp $'Please enter \e[33;1mPassword\e[0m of \e[32mRDS\e[0m: ' RDS_PASSWORD
  echo "RDS_PASSWORD=$RDS_PASSWORD" >> ".env"
  echo # extra echo for read -s

  read -p $'Please enter \e[33;1mARN\e[0m of \e[36mSNS\e[0m: ' SNS_ARN
  echo "SNS_ARN=$SNS_ARN" >> ".env"
fi
