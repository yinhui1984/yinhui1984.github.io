all:
	hugo -D
	
test:
# To ignore errors in a command line, 
# write a - at the beginning of the line's text (after the initial tab). 
# The - is discarded before the command is passed to the shell for execution
	-killall -9 hugo
	hugo -D
	open http://localhost:1313/
	hugo server --disableFastRender


stop:
	killall -9 hugo

list:
	ls -al ./content/posts/
#pull:
#	 git pull
	
	
release:
	@echo "Building site..."
	@hugo -D || (echo "Build failed!" && exit 1)
	@echo "Copying files to docs/..."
	@rm -rf ./docs/*
	@cp -aRf ./public/* ./docs
	@touch ./docs/.nojekyll
	@echo "Committing and pushing..."
	@git add . && git commit -m "auto updated by script" && git push || (echo "Git operation failed!" && exit 1)
	@echo "Deployment complete!"

#
#
###how to use:
## make new file=this_is_one_article.md
#new:pull
#	hugo new posts/$(file)
#	open ./content/posts/$(file) &