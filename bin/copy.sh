# Do the following instead of an arry to be POSIX compliant
# http://unix.stackexchange.com/questions/102891/posix-compliant-way-to-work-with-a-list-of-filenames-possibly-with-whitespace

ASSETS="
node_modules/primer-markdown/build/build.css
node_modules/octicons/build/sprite.octicons.svg
node_modules/hint.css/hint.base.min.css
node_modules/dialog-polyfill/dialog-polyfill.css
"

mkdir -p ./public

set -f; IFS='
'                           # turn off variable value expansion except for splitting at newlines
for file in $ASSETS; do
	set +f; unset IFS       # restore globbing and field splitting at all whitespace
	cp -vf "$file" ./public/
done
set +f; unset IFS           # do it again in case $ASSETS was empty
