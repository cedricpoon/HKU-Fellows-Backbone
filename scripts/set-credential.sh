if [ -z $RDS_HOSTNAME ]
then
  read -p $'Please enter \e[33;1mHOSTNAME\e[0m of RDS: ' RDS_HOSTNAME
  export RDS_HOSTNAME=$RDS_HOSTNAME
fi

if [ -z $RDS_USERNAME ]
then
  read -p $'Please enter \e[33;1mUSERNAME\e[0m of RDS: ' RDS_USERNAME
  export RDS_USERNAME=$RDS_USERNAME
fi

if [ -z $RDS_PASSWORD ]
then
  read -sp $'Please enter \e[33;1mPASSWORD\e[0m of RDS: ' RDS_PASSWORD
  export RDS_PASSWORD=$RDS_PASSWORD
  echo
fi
