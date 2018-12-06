TARGET=$(docker ps -aq --filter ancestor=hkuf-backbone);
if [ ! -z $TARGET ]
then
  docker stop $TARGET;
fi
