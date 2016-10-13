assets=( 
	"node_modules/github-markdown-css/github-markdown.css"
	"node_modules/octicons/build/sprite.octicons.svg"
	"node_modules/hint.css/hint.base.min.css"
)

for file in "${assets[@]}"; do
	cp -vf "$file" public/
done
