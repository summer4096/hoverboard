#!/bin/bash

if [ ! -z $(which fswatch) ]
then
	./build.sh
	fswatch -o -1 ./src | xargs -n1 ./build.sh
else
	while true; do
		./build.sh
		inotifywait src/
	done
fi
