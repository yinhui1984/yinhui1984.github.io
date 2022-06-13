
# #新建一个站点
# ##how to use:
# # make newsite site=myblog
# newsite:
# 	jekyll new $(site)

newpost:
	 go run newPost.go "$(title)"

run:
	-killall -9 ruby
	cd jekyllContent/myblog && bundle exec jekyll serve --trace  &
	sleep 2
	open http://localhost:4000/

##https://jekyllthemes.io/free
##hwo to use: make theme theme=theme-name
#theme:
#	./setTheme.sh $(theme)
#	make run

stop:
	-killall -9 ruby
	#cd jekyllContent/myblog && bundle exec jekyll stop

install:
	cd jekyllContent/myblog && bundle install

release:
	git pull && cp -aRvf ./jekyllContent/myblog/_site/* ./docs/ && git add . && git commit -m "auto updated by script" && git push

help:
	open https://chirpy.cotes.page
	open https://docs.github.com/cn/pages/quickstart

	