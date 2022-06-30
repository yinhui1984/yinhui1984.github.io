all:
	hugo -D
	
test:
# To ignore errors in a command line, 
# write a - at the beginning of the line's text (after the initial tab). 
# The - is discarded before the command is passed to the shell for execution
	-killall -9 hugo
	#hugo server -D &
	hugo server --disableFastRender
	sleep 2
	open http://localhost:1313/

#pull:
#	cd ../ChainBlog/ && git pull && cd -
	
	
release:
	cp -aRf ./public/* ./docs
	git add . && git commit -m "auto updated by script" && git push

#
#
###how to use:
## make new file=this_is_one_article.md
#new:pull
#	hugo new posts/$(file)
#	open ./content/posts/$(file) &