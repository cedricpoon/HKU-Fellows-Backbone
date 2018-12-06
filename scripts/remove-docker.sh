GREEN='\033[1;32m'
RED='\033[0;31m'
DEFAULT='\033[0m'

CONTAINER=$(docker ps -aq --filter ancestor=hkuf-backbone);
IMAGE=$(docker images -q hkuf-backbone);

npm run stop-docker

if [ ! -z $CONTAINER ]
then
  docker rm $CONTAINER
  printf "${GREEN}hkuf-backbone containers are removed!\n${DEFAULT}"
else
  printf "${RED}0 containers are removed\n${DEFAULT}"
fi

if [ ! -z $IMAGE ]
then
  docker rmi $IMAGE
  printf "${GREEN}hkuf-backbone images are removed!\n${DEFAULT}"
else
  printf "${RED}0 images are removed\n${DEFAULT}"
fi
