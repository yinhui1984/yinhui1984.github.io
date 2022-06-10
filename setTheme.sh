#!/usr/bin/env sh


if [ -z "$1" ]; then
  echo "Usage: $0 <theme-name>"
  exit 1
fi

#get args from command line
theme=$1

cd ./jekyllContent/myblog

gemFile=./Gemfile
configFile=./_config.yml

#if no gem '$theme' is found, add it to Gemfile
if ! grep -q "$theme" $gemFile; then
  echo "Adding $theme to Gemfile"
  echo "\n" >> $gemFile
  echo "gem '$theme'" >> $gemFile
fi


#run bundle install
bundle install

#replace theme in _config.yml
sed -i '' "s/^theme:.*/theme: $theme/g" $configFile



