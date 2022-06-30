#!/usr/bin/env sh



if [ -z "$1" ]; then
  echo "Usage: $0 <new-article-name>"
  exit 1
fi


ARTICLE_NAME=""

#combin all args into one string
# shellcheck disable=SC2048
for i in $*; do
  ARTICLE_NAME="$ARTICLE_NAME"-$i
done

#remove first -
ARTICLE_NAME="${ARTICLE_NAME:1}"


ARTICLE_NAME="$ARTICLE_NAME".md

echo "Creating new article: $ARTICLE_NAME"


hugo new posts/"$ARTICLE_NAME"

# shellcheck disable=SC2181
if [ $? -eq 0 ]; then
    open ./content/posts/"$ARTICLE_NAME" > /dev/null 2>&1
else
    echo "failed to create new article"
fi


